import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";
import {
  createCleanupRegistry,
  createTrackedAuthProfile,
  createTrackedCompany,
  loadGuardedLocalSupabase,
  runTrackedSetup,
  trackedInsert,
} from "./lib/local-auth-fixtures.mjs";

const { env, service } = loadGuardedLocalSupabase();
const HOUR_MS = 3_600_000;

function authenticatedClient(userId) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
    sub: userId,
  });
  const signature = createHmac("sha256", env.JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return createClient(env.API_URL, env.ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${header}.${payload}.${signature}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Runs SQL in its own transaction and holds it open for two seconds before
 * committing. `held` resolves once the SQL has run, so callers know its locks are taken.
 */
function runHeldTransaction(sql) {
  const child = spawn(
    "docker",
    ["exec", "-i", "supabase_db_ecommerce", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "";
  let markHeld;
  const held = new Promise((resolve) => { markHeld = resolve; });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (output.includes("held")) markHeld();
  });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.stdin.end(`begin;\n${sql}\nselect 'held';\nselect pg_sleep(2);\ncommit;\n`);
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(output) : reject(new Error(`held transaction failed: ${output}`))));
  });
  return { held: Promise.race([held, done]), done };
}

async function createFixture() {
  const registry = createCleanupRegistry();
  return runTrackedSetup(registry, async () => {
    const empresaId = await createTrackedCompany(service, registry, "delete-guard");
    const buyer = await createTrackedAuthProfile(service, registry, { label: "delete-guard-buyer", empresaId, role: "cliente", onboarding: false });
    const admin = await createTrackedAuthProfile(service, registry, { label: "delete-guard-admin", empresaId, role: "admin", onboarding: false });
    const address = await trackedInsert(service, registry, "direccion_usuario", {
      usuario_id: buyer.profileId, direccion: "Test 123", ciudad: "Montevideo", pais: "Uruguay",
      codigo_postal: "11000", tipo_direccion: "hogar",
    });
    const product = { empresa_id: empresaId, descripcion: "Delete guard fixture", precio: 100, estado: "published" };
    const simple = await trackedInsert(service, registry, "producto", { ...product, id: randomUUID(), nombre: "Simple", stock: 10, usa_variantes: false });
    const withVariants = await trackedInsert(service, registry, "producto", { ...product, id: randomUUID(), nombre: "Variantes", stock: 0, usa_variantes: true });
    const variant = await trackedInsert(service, registry, "producto_variante", {
      id: randomUUID(), empresa_id: empresaId, producto_id: withVariants.id, talle: "M", stock: 10, activo: true,
    });
    return { registry, empresaId, buyerId: buyer.profileId, adminAuthId: admin.authUserId, addressId: address.id, simpleId: simple.id, variantProductId: withVariants.id, variantId: variant.id };
  });
}

async function createOrder(fixture, { estado = "pendiente_pago", expiresInMs = HOUR_MS, productoId, varianteId = null }) {
  const pedidoId = randomUUID();
  const { error } = await service.from("pedido").insert({
    id: pedidoId, usuario_id: fixture.buyerId, empresa_id: fixture.empresaId, direccion_envio_id: fixture.addressId,
    estado, total: 100, direccion_envio_snapshot: { direccion: "Test 123" },
    expira_en: new Date(Date.now() + expiresInMs).toISOString(), bloqueado_por_stock: estado === "bloqueado",
  });
  assert.ifError(error);
  const { error: itemError } = await service.from("pedido_item").insert({
    pedido_id: pedidoId, empresa_id: fixture.empresaId, producto_id: productoId, variante_id: varianteId,
    nombre_producto: "Delete guard item", talle: varianteId ? "M" : null, precio_unitario: 100, cantidad: 1,
  });
  assert.ifError(itemError);
  return pedidoId;
}

async function consolidateApprovedPayment(fixture, pedidoId) {
  const intentoId = randomUUID();
  const { error } = await service.from("intento_pago").insert({
    id: intentoId, pedido_id: pedidoId, empresa_id: fixture.empresaId, estado: "aprobado",
    canal_pago: "mercadopago", external_id: `payment-${intentoId}`,
  });
  assert.ifError(error);
  return service.rpc("consolidar_pago_pedido", { p_intento_pago_id: intentoId });
}

async function rowExists(table, id) {
  const { data, error } = await service.from(table).select("id").eq("id", id).maybeSingle();
  assert.ifError(error);
  return data !== null;
}

async function withFixture(run) {
  const fixture = await createFixture();
  try {
    await run(fixture);
  } finally {
    const { error } = await service.from("pedido").delete().eq("empresa_id", fixture.empresaId);
    assert.ifError(error);
    await fixture.registry.cleanup();
  }
}

function assertPendingOrderGuard(error) {
  assert.ok(error, "delete must be rejected");
  assert.equal(error.code, "55006");
  assert.equal(error.message, "producto_en_pedido_activo");
}

test("a product in a pending order cannot be deleted and the order still consolidates", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createOrder(fixture, { productoId: fixture.simpleId });
    const { error } = await service.from("producto").delete().eq("id", fixture.simpleId);
    assertPendingOrderGuard(error);
    assert.equal(await rowExists("producto", fixture.simpleId), true);

    const consolidation = await consolidateApprovedPayment(fixture, pedidoId);
    assert.ifError(consolidation.error);
    assert.equal(consolidation.data[0].ok, true);
  });
});

test("a panel admin cannot delete a variant in a pending order despite pedido_item RLS", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createOrder(fixture, { productoId: fixture.variantProductId, varianteId: fixture.variantId });
    const admin = authenticatedClient(fixture.adminAuthId);
    const { error } = await admin.from("producto_variante").delete().eq("id", fixture.variantId);
    assertPendingOrderGuard(error);
    assert.equal(await rowExists("producto_variante", fixture.variantId), true);

    const sibling = await trackedInsert(service, fixture.registry, "producto_variante", {
      id: randomUUID(), empresa_id: fixture.empresaId, producto_id: fixture.variantProductId, talle: "L", stock: 1, activo: true,
    });
    const siblingDelete = await admin.from("producto_variante").delete().eq("id", sibling.id).select("id");
    assert.ifError(siblingDelete.error);
    assert.equal(siblingDelete.data.length, 1, "a variant outside pending orders stays deletable");

    const productDelete = await admin.from("producto").delete().eq("id", fixture.variantProductId);
    assertPendingOrderGuard(productDelete.error);

    const consolidation = await consolidateApprovedPayment(fixture, pedidoId);
    assert.ifError(consolidation.error);
    assert.equal(consolidation.data[0].ok, true);
  });
});

test("expired, paid, blocked and cancelled orders do not block deletion", async (t) => {
  for (const [name, order] of [
    ["expired pending", { expiresInMs: -HOUR_MS }],
    ["paid", { estado: "pagado" }],
    ["blocked", { estado: "bloqueado" }],
    ["cancelled", { estado: "cancelado" }],
  ]) {
    await t.test(name, async () => {
      await withFixture(async (fixture) => {
        if (order.estado === "pagado") {
          const pedidoId = await createOrder(fixture, { productoId: fixture.simpleId });
          const consolidation = await consolidateApprovedPayment(fixture, pedidoId);
          assert.equal(consolidation.data?.[0]?.ok, true);
        } else {
          await createOrder(fixture, { ...order, productoId: fixture.simpleId });
        }
        const { error } = await service.from("producto").delete().eq("id", fixture.simpleId);
        assert.ifError(error);
        assert.equal(await rowExists("producto", fixture.simpleId), false);
      });
    });
  }
});

test("a delete waits for a concurrent order insert and then rejects", async () => {
  await withFixture(async (fixture) => {
    const pedidoId = await createOrder(fixture, { productoId: fixture.variantProductId, varianteId: fixture.variantId });
    const { error: removeError } = await service.from("pedido_item").delete().eq("pedido_id", pedidoId);
    assert.ifError(removeError);

    const heldOrderItem = runHeldTransaction(`
      insert into public.pedido_item (pedido_id, empresa_id, producto_id, variante_id, nombre_producto, talle, precio_unitario, cantidad)
      values ('${pedidoId}', '${fixture.empresaId}', '${fixture.simpleId}', null, 'Concurrent item', null, 100, 1);
    `);
    await heldOrderItem.held;

    const startedAt = Date.now();
    const { error } = await service.from("producto").delete().eq("id", fixture.simpleId);
    await heldOrderItem.done;
    assert.ok(Date.now() - startedAt >= 1_000, "delete must wait for the order transaction");
    assertPendingOrderGuard(error);
    assert.equal(await rowExists("producto", fixture.simpleId), true);
  });
});
