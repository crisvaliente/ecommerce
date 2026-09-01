import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

const env = localSupabaseEnv();
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(env.API_URL, env.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fixture() {
  const { data: addresses, error: addressError } = await service
    .from("direccion_usuario")
    .select("id, usuario_id")
    .limit(20);
  assert.ifError(addressError);
  const distinctAddresses = [];
  for (const address of addresses ?? []) {
    if (!distinctAddresses.some((item) => item.usuario_id === address.usuario_id)) {
      distinctAddresses.push(address);
    }
  }
  const createdUserIds = [];
  while (distinctAddresses.length < 2) {
    const userId = randomUUID();
    const supabaseUid = randomUUID();
    const { data: user, error: userError } = await service
      .from("usuario")
      .insert({
        id: userId,
        supabase_uid: supabaseUid,
        nombre: "Checkout Idempotency Test",
        correo: `checkout-${userId}@example.test`,
        rol: "cliente",
        empresa_id: null,
        onboarding: true,
      })
      .select("id")
      .single();
    assert.ifError(userError);
    createdUserIds.push(user.id);

    const { data: address, error: insertAddressError } = await service
      .from("direccion_usuario")
      .insert({
        usuario_id: user.id,
        direccion: "Test 123",
        ciudad: "Montevideo",
        pais: "Uruguay",
        codigo_postal: "11000",
        tipo_direccion: "hogar",
      })
      .select("id, usuario_id")
      .single();
    assert.ifError(insertAddressError);
    distinctAddresses.push(address);
  }

  let createdEmpresaId = null;
  let { data: product, error: productError } = await service
    .from("producto")
    .select("id, empresa_id")
    .eq("usa_variantes", false)
    .gt("stock", 0)
    .limit(1)
    .maybeSingle();
  assert.ifError(productError);

  if (!product) {
    const empresaId = randomUUID();
    const { error: empresaError } = await service.from("empresa").insert({
      id: empresaId,
      nombre: "Checkout Idempotency Test Store",
      slug: `checkout-${empresaId}`,
    });
    assert.ifError(empresaError);
    createdEmpresaId = empresaId;

    const { data: insertedProduct, error: insertProductError } = await service
      .from("producto")
      .insert({
        id: randomUUID(),
        nombre: "Checkout Idempotency Product",
        descripcion: "Local transactional test fixture",
        precio: 1250,
        stock: 100,
        empresa_id: empresaId,
        estado: "published",
        usa_variantes: false,
      })
      .select("id, empresa_id")
      .single();
    assert.ifError(insertProductError);
    product = insertedProduct;
  }

  return { addresses: distinctAddresses, product, createdUserIds, createdEmpresaId };
}

function rpcParams({ address, product, key, fingerprint, productId = product.id }) {
  return {
    p_usuario_id: address.usuario_id,
    p_empresa_id: product.empresa_id,
    p_direccion_envio_id: address.id,
    p_items: [{ producto_id: productId, variante_id: null, cantidad: 1 }],
    p_idempotency_key: key,
    p_request_fingerprint: fingerprint,
  };
}

async function create(params) {
  const { data, error } = await service.rpc("crear_pedido_con_items_idempotente", params);
  if (error) throw new Error(error.message);
  assert.equal(data.length, 1);
  return data[0];
}

async function cleanup(pedidoIds) {
  const ids = [...new Set(pedidoIds.filter(Boolean))];
  if (ids.length === 0) return;
  const { error } = await service.from("pedido").delete().in("id", ids);
  assert.ifError(error);
}

test("order wrapper is idempotent across replay, concurrency, ambiguity and users", async () => {
  const { addresses, product, createdUserIds, createdEmpresaId } = await fixture();
  const createdPedidos = [];

  try {
    const sequentialKey = randomUUID();
    const sequentialParams = rpcParams({
      address: addresses[0], product, key: sequentialKey, fingerprint: "a".repeat(64),
    });
    const first = await create(sequentialParams);
    const replay = await create(sequentialParams);
    createdPedidos.push(first.pedido_id);
    assert.equal(first.reutilizado, false);
    assert.equal(replay.reutilizado, true);
    assert.equal(replay.pedido_id, first.pedido_id);

    const concurrentKey = randomUUID();
    const concurrentParams = rpcParams({
      address: addresses[0], product, key: concurrentKey, fingerprint: "b".repeat(64),
    });
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () => create(concurrentParams)),
    );
    createdPedidos.push(concurrent[0].pedido_id);
    assert.equal(new Set(concurrent.map((row) => row.pedido_id)).size, 1);
    assert.equal(concurrent.filter((row) => row.reutilizado === false).length, 1);

    const conflictKey = randomUUID();
    const original = await create(rpcParams({
      address: addresses[0], product, key: conflictKey, fingerprint: "c".repeat(64),
    }));
    createdPedidos.push(original.pedido_id);
    await assert.rejects(
      create(rpcParams({
        address: addresses[0], product, key: conflictKey, fingerprint: "d".repeat(64),
      })),
      /idempotency_key_reused/,
    );

    const sharedKey = randomUUID();
    const [userOne, userTwo] = await Promise.all([
      create(rpcParams({
        address: addresses[0], product, key: sharedKey, fingerprint: "e".repeat(64),
      })),
      create(rpcParams({
        address: addresses[1], product, key: sharedKey, fingerprint: "e".repeat(64),
      })),
    ]);
    createdPedidos.push(userOne.pedido_id, userTwo.pedido_id);
    assert.notEqual(userOne.pedido_id, userTwo.pedido_id);

    const rollbackKey = randomUUID();
    await assert.rejects(
      create(rpcParams({
        address: addresses[0],
        product,
        key: rollbackKey,
        fingerprint: "f".repeat(64),
        productId: "00000000-0000-4000-8000-000000000000",
      })),
      /producto_no_existe/,
    );
    const { count: rollbackMappings, error: rollbackReadError } = await service
      .from("checkout_pedido_idempotencia")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", addresses[0].usuario_id)
      .eq("idempotency_key", rollbackKey);
    assert.ifError(rollbackReadError);
    assert.equal(rollbackMappings, 0);
    const afterRollback = await create(rpcParams({
      address: addresses[0], product, key: rollbackKey, fingerprint: "f".repeat(64),
    }));
    createdPedidos.push(afterRollback.pedido_id);

    const ambiguousKey = randomUUID();
    const ambiguousParams = rpcParams({
      address: addresses[0], product, key: ambiguousKey, fingerprint: "1".repeat(64),
    });
    const discardedResponse = await create(ambiguousParams);
    const recoveredResponse = await create(ambiguousParams);
    createdPedidos.push(discardedResponse.pedido_id);
    assert.equal(recoveredResponse.pedido_id, discardedResponse.pedido_id);
    assert.equal(recoveredResponse.reutilizado, true);
  } finally {
    await cleanup(createdPedidos);
    if (createdUserIds.length > 0) {
      const { error } = await service.from("usuario").delete().in("id", createdUserIds);
      assert.ifError(error);
    }
    if (createdEmpresaId) {
      const { error } = await service.from("empresa").delete().eq("id", createdEmpresaId);
      assert.ifError(error);
    }
  }
});

test("preference persistence is conditional and preference_id is globally unique", async () => {
  const { addresses, product, createdUserIds, createdEmpresaId } = await fixture();
  const createdPedidos = [];

  try {
    const pedidoOne = await create(rpcParams({
      address: addresses[0], product, key: randomUUID(), fingerprint: "2".repeat(64),
    }));
    const pedidoTwo = await create(rpcParams({
      address: addresses[0], product, key: randomUUID(), fingerprint: "3".repeat(64),
    }));
    createdPedidos.push(pedidoOne.pedido_id, pedidoTwo.pedido_id);

    const createAttempt = async (pedidoId) => {
      const { data, error } = await service.rpc("crear_intento_pago", {
        p_usuario_id: addresses[0].usuario_id,
        p_pedido_id: pedidoId,
        p_canal_pago: "mercadopago",
      });
      assert.ifError(error);
      return data[0].intento_pago_id;
    };
    const attemptOne = await createAttempt(pedidoOne.pedido_id);
    const attemptTwo = await createAttempt(pedidoTwo.pedido_id);

    const startedAt = new Date().toISOString();
    const claims = await Promise.all(Array.from({ length: 8 }, () =>
      service
        .from("intento_pago")
        .update({
          preference_creation_state: "creating",
          preference_creation_started_at: startedAt,
        })
        .eq("id", attemptOne)
        .eq("preference_creation_state", "not_started")
        .is("preference_id", null)
        .select("id, preference_creation_state")
        .maybeSingle()
    ));
    claims.forEach(({ error }) => assert.ifError(error));
    assert.equal(claims.filter(({ data }) => data !== null).length, 1);

    const { data: claimedState, error: claimedStateError } = await service
      .from("intento_pago")
      .select("estado, preference_creation_state")
      .eq("id", attemptOne)
      .single();
    assert.ifError(claimedStateError);
    assert.equal(claimedState.estado, "iniciado");
    assert.equal(claimedState.preference_creation_state, "creating");

    const winner = {
      id: "pref-cas-winner",
      url: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-cas-winner",
    };
    const { data: persisted, error: persistError } = await service
      .from("intento_pago")
      .update({
        preference_id: winner.id,
        preference_init_point: winner.url,
        preference_creation_state: "ready",
        preference_last_error: null,
      })
      .eq("id", attemptOne)
      .eq("preference_creation_state", "creating")
      .is("preference_id", null)
      .select("preference_id, preference_init_point, preference_creation_state")
      .single();
    assert.ifError(persistError);
    assert.equal(persisted.preference_creation_state, "ready");

    const { data: readyAttempt, error: readyAttemptError } = await service
      .from("intento_pago")
      .select("estado")
      .eq("id", attemptOne)
      .single();
    assert.ifError(readyAttemptError);
    assert.equal(readyAttempt.estado, "iniciado");

    const duplicate = await service
      .from("intento_pago")
      .update({ preference_id: winner.id })
      .eq("id", attemptTwo);
    assert.ok(duplicate.error, "the same provider preference cannot belong to two attempts");

    const staleStartedAt = "2020-01-01T00:00:00.000Z";
    const { error: staleSetupError } = await service
      .from("intento_pago")
      .update({
        preference_creation_state: "creating",
        preference_creation_started_at: staleStartedAt,
      })
      .eq("id", attemptTwo)
      .eq("preference_creation_state", "not_started");
    assert.ifError(staleSetupError);

    const { data: staleReconciled, error: staleError } = await service
      .from("intento_pago")
      .update({
        preference_creation_state: "ambiguous",
        preference_last_error: "mercadopago_preference_stale",
      })
      .eq("id", attemptTwo)
      .eq("preference_creation_state", "creating")
      .eq("preference_creation_started_at", staleStartedAt)
      .select("preference_creation_state, preference_last_error")
      .single();
    assert.ifError(staleError);
    assert.equal(staleReconciled.preference_creation_state, "ambiguous");
  } finally {
    await cleanup(createdPedidos);
    if (createdUserIds.length > 0) {
      const { error } = await service.from("usuario").delete().in("id", createdUserIds);
      assert.ifError(error);
    }
    if (createdEmpresaId) {
      const { error } = await service.from("empresa").delete().eq("id", createdEmpresaId);
      assert.ifError(error);
    }
  }
});

test("new table and wrapper are unavailable to anon", async () => {
  const tableRead = await anon.from("checkout_pedido_idempotencia").select("pedido_id").limit(1);
  assert.ok(tableRead.error, "anon table read must fail");

  const rpcCall = await anon.rpc("crear_pedido_con_items_idempotente", {
    p_usuario_id: randomUUID(),
    p_empresa_id: randomUUID(),
    p_direccion_envio_id: randomUUID(),
    p_items: [],
    p_idempotency_key: randomUUID(),
    p_request_fingerprint: "a".repeat(64),
  });
  assert.ok(rpcCall.error, "anon wrapper execution must fail");
});
