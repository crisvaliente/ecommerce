import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

function localSupabaseEnv() {
  const output = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function authenticatedJwt(secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
    sub: randomUUID(),
  });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const env = localSupabaseEnv();
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(env.API_URL, env.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authenticated = createClient(env.API_URL, env.ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${authenticatedJwt(env.JWT_SECRET)}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

function startHeldDatabaseTransaction(statement) {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_ecommerce",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  const done = new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`lock holder failed (${code}): ${stderr || stdout}`));
    });
  });

  child.stdin.end(`
    begin;
    ${statement}
    select pg_sleep(2);
    commit;
  `);

  return done;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createFixture() {
  const empresaId = randomUUID();
  const otherEmpresaId = randomUUID();
  const userId = randomUUID();
  const actorId = randomUUID();
  const productId = randomUUID();

  for (const [id, name] of [[empresaId, "Order Operations"], [otherEmpresaId, "Other Tenant"]]) {
    const { error } = await service.from("empresa").insert({
      id,
      nombre: `${name} Test`,
      slug: `order-ops-${id}`,
    });
    assert.ifError(error);
  }

  const { error: userError } = await service.from("usuario").insert({
    id: userId,
    supabase_uid: randomUUID(),
    nombre: "Order Operations Buyer",
    correo: `order-ops-${userId}@example.test`,
    rol: "cliente",
    empresa_id: empresaId,
    onboarding: true,
  });
  assert.ifError(userError);

  const { data: address, error: addressError } = await service
    .from("direccion_usuario")
    .insert({
      usuario_id: userId,
      direccion: "Test 123",
      ciudad: "Montevideo",
      pais: "Uruguay",
      codigo_postal: "11000",
      tipo_direccion: "hogar",
    })
    .select("id")
    .single();
  assert.ifError(addressError);

  const { error: productError } = await service.from("producto").insert({
    id: productId,
    nombre: "Order Operations Product",
    descripcion: "Transactional order state fixture",
    precio: 100,
    stock: 99,
    empresa_id: empresaId,
    estado: "published",
    usa_variantes: false,
  });
  assert.ifError(productError);

  return { empresaId, otherEmpresaId, userId, actorId, productId, addressId: address.id };
}

async function createOrder(fixture, state = "pendiente_pago") {
  const pedidoId = randomUUID();
  const { error } = await service.from("pedido").insert({
    id: pedidoId,
    usuario_id: fixture.userId,
    empresa_id: fixture.empresaId,
    direccion_envio_id: fixture.addressId,
    estado: state,
    total: 100,
    direccion_envio_snapshot: { direccion: "Test 123" },
    expira_en: new Date(Date.now() + 3_600_000).toISOString(),
    bloqueado_por_stock: state === "bloqueado",
  });
  assert.ifError(error);
  return pedidoId;
}

async function addOrderItem(fixture, pedidoId) {
  const { error } = await service.from("pedido_item").insert({
    pedido_id: pedidoId,
    empresa_id: fixture.empresaId,
    producto_id: fixture.productId,
    variante_id: null,
    nombre_producto: "Order Operations Product",
    talle: null,
    precio_unitario: 100,
    cantidad: 1,
  });
  assert.ifError(error);
}

async function createApprovedAttempt(fixture, pedidoId) {
  const intentoId = randomUUID();
  const { error } = await service.from("intento_pago").insert({
    id: intentoId,
    pedido_id: pedidoId,
    empresa_id: fixture.empresaId,
    estado: "aprobado",
    canal_pago: "mercadopago",
    external_id: `payment-${intentoId}`,
  });
  assert.ifError(error);
  return intentoId;
}

async function createPaidOrder(fixture) {
  const pedidoId = await createOrder(fixture);
  const intentoId = await createApprovedAttempt(fixture, pedidoId);
  const { error: paidError } = await service
    .from("pedido")
    .update({ estado: "pagado", intento_pago_consolidado_id: intentoId })
    .eq("id", pedidoId);
  assert.ifError(paidError);
  return pedidoId;
}

async function transition(fixture, pedidoId, expected, target, overrides = {}) {
  const { data, error } = await service.rpc("transicionar_pedido_operacional", {
    p_pedido_id: pedidoId,
    p_empresa_id: overrides.empresaId ?? fixture.empresaId,
    p_expected_state: expected,
    p_target_state: target,
    p_actor_id: overrides.actorId ?? fixture.actorId,
    p_motivo: overrides.reason ?? null,
  });
  assert.ifError(error);
  assert.equal(data.length, 1);
  return data[0];
}

async function eventCount(pedidoId) {
  const { count, error } = await service
    .from("pedido_estado_evento")
    .select("*", { count: "exact", head: true })
    .eq("pedido_id", pedidoId);
  assert.ifError(error);
  return count;
}

async function cleanup(fixture) {
  const { error: ordersError } = await service.from("pedido").delete().eq("empresa_id", fixture.empresaId);
  assert.ifError(ordersError);
  const { error: productError } = await service.from("producto").delete().eq("id", fixture.productId);
  assert.ifError(productError);
  const { error: addressError } = await service.from("direccion_usuario").delete().eq("id", fixture.addressId);
  assert.ifError(addressError);
  const { error: userError } = await service.from("usuario").delete().eq("id", fixture.userId);
  assert.ifError(userError);
  const { error: companiesError } = await service
    .from("empresa")
    .delete()
    .in("id", [fixture.empresaId, fixture.otherEmpresaId]);
  assert.ifError(companiesError);
}

async function withFixture(run) {
  const fixture = await createFixture();
  try {
    await run(fixture);
  } finally {
    await cleanup(fixture);
  }
}

test("applies the complete paid fulfillment path and records immutable audit events", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createPaidOrder(fixture);
    const steps = [
      ["pagado", "en_preparacion"],
      ["en_preparacion", "enviado"],
      ["enviado", "entregado"],
    ];

    for (const [expected, target] of steps) {
      const result = await transition(fixture, pedidoId, expected, target, { reason: `move:${target}` });
      assert.equal(result.ok, true);
      assert.equal(result.codigo_resultado, "transicion_aplicada");
      assert.equal(result.estado_anterior, expected);
      assert.equal(result.estado_final, target);
      assert.equal(result.idempotente, false);
    }

    const { data: events, error } = await service
      .from("pedido_estado_evento")
      .select("estado_anterior, estado_nuevo, actor_id, motivo")
      .eq("pedido_id", pedidoId)
      .order("creado_en");
    assert.ifError(error);
    assert.deepEqual(events.map(({ estado_anterior, estado_nuevo }) => [estado_anterior, estado_nuevo]), steps);
    assert.ok(events.every((event) => event.actor_id === fixture.actorId));
    assert.equal(events[2].motivo, "move:entregado");

    const immutable = await service
      .from("pedido_estado_evento")
      .update({ motivo: "tampered" })
      .eq("pedido_id", pedidoId);
    assert.ok(immutable.error, "audit events must reject updates, including service-role updates");
  });
});

test("rejects jumps, backwards transitions, and terminal states", async () => {
  await withFixture(async (fixture) => {
    const paidId = await createPaidOrder(fixture);
    assert.equal((await transition(fixture, paidId, "pagado", "enviado")).codigo_resultado, "transicion_no_permitida");

    assert.equal((await transition(fixture, paidId, "pagado", "en_preparacion")).ok, true);
    assert.equal((await transition(fixture, paidId, "en_preparacion", "pagado")).codigo_resultado, "transicion_no_permitida");
    assert.equal((await transition(fixture, paidId, "pagado", "enviado")).codigo_resultado, "expected_state_stale");

    const deliveredId = await createPaidOrder(fixture);
    await transition(fixture, deliveredId, "pagado", "en_preparacion");
    await transition(fixture, deliveredId, "en_preparacion", "enviado");
    await transition(fixture, deliveredId, "enviado", "entregado");
    assert.equal((await transition(fixture, deliveredId, "entregado", "enviado")).codigo_resultado, "estado_terminal");

    const blockedId = await createOrder(fixture, "bloqueado");
    assert.equal((await transition(fixture, blockedId, "bloqueado", "en_preparacion")).codigo_resultado, "estado_terminal");

    const cancelledId = await createOrder(fixture);
    await transition(fixture, cancelledId, "pendiente_pago", "cancelado");
    assert.equal((await transition(fixture, cancelledId, "cancelado", "en_preparacion")).codigo_resultado, "estado_terminal");
  });
});

test("same-target retries and concurrent calls are idempotent without duplicate events", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createPaidOrder(fixture);
    const calls = await Promise.all(
      Array.from({ length: 8 }, () => transition(fixture, pedidoId, "pagado", "en_preparacion")),
    );
    assert.equal(calls.filter((row) => row.codigo_resultado === "transicion_aplicada").length, 1);
    assert.equal(calls.filter((row) => row.codigo_resultado === "retry_idempotente").length, 7);
    assert.equal(await eventCount(pedidoId), 1);

    const retry = await transition(fixture, pedidoId, "pagado", "en_preparacion");
    assert.equal(retry.idempotente, true);
    assert.equal(await eventCount(pedidoId), 1);
  });
});

test("enforces tenant and consolidated-payment invariants", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createPaidOrder(fixture);
    const wrongTenant = await transition(fixture, pedidoId, "pagado", "en_preparacion", {
      empresaId: fixture.otherEmpresaId,
    });
    assert.equal(wrongTenant.codigo_resultado, "empresa_no_coincide");
    assert.equal(await eventCount(pedidoId), 0);

    for (const state of ["pagado", "en_preparacion", "enviado", "entregado"]) {
      const invalid = await service.from("pedido").insert({
        id: randomUUID(),
        usuario_id: fixture.userId,
        empresa_id: fixture.empresaId,
        direccion_envio_id: fixture.addressId,
        estado: state,
        total: 100,
        direccion_envio_snapshot: { direccion: "Invalid" },
        expira_en: new Date(Date.now() + 3_600_000).toISOString(),
      });
      assert.ok(invalid.error, `${state} must require a consolidated payment attempt`);
    }
  });
});

test("allows cancellation only when payment and preference state are safe", async () => {
  await withFixture(async (fixture) => {
    const safeId = await createOrder(fixture);
    const safe = await transition(fixture, safeId, "pendiente_pago", "cancelado", { reason: "buyer_request" });
    assert.equal(safe.ok, true);
    assert.equal(safe.estado_final, "cancelado");

    const terminalAttemptId = await createOrder(fixture);
    const { error: terminalAttemptError } = await service.from("intento_pago").insert({
      id: randomUUID(),
      pedido_id: terminalAttemptId,
      empresa_id: fixture.empresaId,
      estado: "rechazado",
      canal_pago: "mercadopago",
      preference_creation_state: "failed",
      preference_last_error: "provider_rejected",
    });
    assert.ifError(terminalAttemptError);
    const safeAfterTerminalAttempt = await transition(
      fixture,
      terminalAttemptId,
      "pendiente_pago",
      "cancelado",
    );
    assert.equal(safeAfterTerminalAttempt.ok, true);

    const scenarios = [
      { estado: "iniciado", preference_creation_state: "not_started" },
      { estado: "rechazado", preference_creation_state: "creating", preference_creation_started_at: new Date().toISOString() },
      { estado: "rechazado", preference_creation_state: "ready", preference_id: `pref-${randomUUID()}`, preference_init_point: "https://example.test/pay" },
      { estado: "rechazado", preference_creation_state: "ambiguous" },
      { estado: "aprobado", preference_creation_state: "not_started" },
    ];

    for (const scenario of scenarios) {
      const pedidoId = await createOrder(fixture);
      const { error } = await service.from("intento_pago").insert({
        id: randomUUID(),
        pedido_id: pedidoId,
        empresa_id: fixture.empresaId,
        canal_pago: "mercadopago",
        external_id: null,
        ...scenario,
      });
      assert.ifError(error);
      const rejected = await transition(fixture, pedidoId, "pendiente_pago", "cancelado");
      assert.equal(rejected.codigo_resultado, "cancelacion_pago_en_vuelo");
      assert.equal(await eventCount(pedidoId), 0);
    }
  });
});

test("cancellation and payment consolidation serialize on the same pedido row lock", async () => {
  await withFixture(async (fixture) => {
    const stockBefore = async () => {
      const { data, error } = await service.from("producto").select("stock").eq("id", fixture.productId).single();
      assert.ifError(error);
      return data.stock;
    };

    const cancelFirstId = await createOrder(fixture);
    const cancelFirst = startHeldDatabaseTransaction(`
      select codigo_resultado
      from public.transicionar_pedido_operacional(
        '${cancelFirstId}'::uuid,
        '${fixture.empresaId}'::uuid,
        'pendiente_pago'::public.pedido_estado,
        'cancelado'::public.pedido_estado,
        '${fixture.actorId}'::uuid,
        'concurrent_cancel_first'
      );
    `);
    await delay(250);

    const cancelFirstStartedAt = Date.now();
    const lateApprovalPromise = (async () => {
      const intentoId = await createApprovedAttempt(fixture, cancelFirstId);
      const consolidation = await service.rpc("consolidar_pago_pedido", {
        p_intento_pago_id: intentoId,
      });
      return consolidation;
    })();
    const [cancelFirstOutput, lateConsolidation] = await Promise.all([
      cancelFirst,
      lateApprovalPromise,
    ]);
    assert.match(cancelFirstOutput, /transicion_aplicada/);
    assert.ok(Date.now() - cancelFirstStartedAt >= 1_000, "approval must wait for cancellation commit");
    assert.ifError(lateConsolidation.error);
    assert.equal(lateConsolidation.data[0].ok, false);
    assert.equal(lateConsolidation.data[0].codigo_resultado, "pedido_no_consolidable");

    const { data: cancelledOrder, error: cancelledOrderError } = await service
      .from("pedido")
      .select("estado, intento_pago_consolidado_id")
      .eq("id", cancelFirstId)
      .single();
    assert.ifError(cancelledOrderError);
    assert.deepEqual(cancelledOrder, { estado: "cancelado", intento_pago_consolidado_id: null });
    assert.equal(await eventCount(cancelFirstId), 1);

    const approvalFirstId = await createOrder(fixture);
    await addOrderItem(fixture, approvalFirstId);
    const approvalFirstAttemptId = await createApprovedAttempt(fixture, approvalFirstId);
    const stockBeforeApproval = await stockBefore();
    const approvalFirst = startHeldDatabaseTransaction(`
      select codigo_resultado
      from public.consolidar_pago_pedido('${approvalFirstAttemptId}'::uuid);
    `);
    await delay(250);

    const lateCancellationPromise = transition(
      fixture,
      approvalFirstId,
      "pendiente_pago",
      "cancelado",
    );
    const approvalFirstStartedAt = Date.now();
    const [approvalFirstOutput, lateCancellation] = await Promise.all([
      approvalFirst,
      lateCancellationPromise,
    ]);
    assert.match(approvalFirstOutput, /consolidado/);
    assert.ok(Date.now() - approvalFirstStartedAt >= 1_000, "cancellation must wait for consolidation commit");
    assert.equal(lateCancellation.ok, false);
    assert.equal(lateCancellation.codigo_resultado, "expected_state_stale");

    const { data: paidOrder, error: paidOrderError } = await service
      .from("pedido")
      .select("estado, intento_pago_consolidado_id")
      .eq("id", approvalFirstId)
      .single();
    assert.ifError(paidOrderError);
    assert.deepEqual(paidOrder, {
      estado: "pagado",
      intento_pago_consolidado_id: approvalFirstAttemptId,
    });
    assert.equal(await eventCount(approvalFirstId), 0);
    assert.equal(await stockBefore(), stockBeforeApproval - 1);

    const repeatedConsolidation = await service.rpc("consolidar_pago_pedido", {
      p_intento_pago_id: approvalFirstAttemptId,
    });
    assert.ifError(repeatedConsolidation.error);
    assert.equal(repeatedConsolidation.data[0].codigo_resultado, "idempotente");
    assert.equal(await stockBefore(), stockBeforeApproval - 1);
  });
});

test("operational transitions never mutate stock", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createPaidOrder(fixture);
    const readStock = async () => {
      const { data, error } = await service.from("producto").select("stock").eq("id", fixture.productId).single();
      assert.ifError(error);
      return data.stock;
    };
    const before = await readStock();
    await transition(fixture, pedidoId, "pagado", "en_preparacion");
    await transition(fixture, pedidoId, "en_preparacion", "enviado");
    await transition(fixture, pedidoId, "enviado", "entregado");
    assert.equal(await readStock(), before);
  });
});

test("RPC execution and audit writes are sovereign-only", async () => {
  const params = {
    p_pedido_id: randomUUID(),
    p_empresa_id: randomUUID(),
    p_expected_state: "pagado",
    p_target_state: "en_preparacion",
    p_actor_id: randomUUID(),
    p_motivo: null,
  };
  const anonRpc = await anon.rpc("transicionar_pedido_operacional", params);
  const authenticatedRpc = await authenticated.rpc("transicionar_pedido_operacional", params);
  assert.equal(anonRpc.error?.code, "42501");
  assert.equal(authenticatedRpc.error?.code, "42501");
  assert.ok((await anon.from("pedido_estado_evento").select("id").limit(1)).error);
  assert.ok((await authenticated.from("pedido_estado_evento").select("id").limit(1)).error);

  const directAuditWrite = await service.from("pedido_estado_evento").insert({
    pedido_id: randomUUID(),
    empresa_id: randomUUID(),
    estado_anterior: "pagado",
    estado_nuevo: "en_preparacion",
    actor_id: randomUUID(),
  });
  assert.equal(directAuditWrite.error?.code, "42501");
});
