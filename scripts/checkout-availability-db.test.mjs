import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createCleanupRegistry,
  createTrackedAuthProfile,
  createTrackedCompany,
  loadGuardedLocalSupabase,
  runTrackedSetup,
  trackedInsert,
} from "./lib/local-auth-fixtures.mjs";

// Run alone or with the other DB suites:
//   ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --test scripts/checkout-availability-db.test.mjs
const { service } = loadGuardedLocalSupabase();

function sql(query) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_ecommerce", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atc", query],
    { encoding: "utf8" },
  ).trim();
}

async function insertProduct(registry, empresaId, values) {
  return trackedInsert(service, registry, "producto", {
    id: randomUUID(),
    descripcion: "Checkout availability fixture",
    empresa_id: empresaId,
    ...values,
  });
}

async function fixture() {
  const registry = createCleanupRegistry();
  return runTrackedSetup(registry, async () => {
    const empresaId = await createTrackedCompany(service, registry, "checkout-availability");
    const otherEmpresaId = await createTrackedCompany(service, registry, "checkout-availability-other");
    const buyer = await createTrackedAuthProfile(service, registry, { label: "availability-buyer" });
    const address = await trackedInsert(service, registry, "direccion_usuario", {
      usuario_id: buyer.profileId,
      direccion: "Test availability",
      ciudad: "Salto",
      pais: "Uruguay",
      codigo_postal: "50000",
      tipo_direccion: "hogar",
    });

    const simple = await insertProduct(registry, empresaId, {
      nombre: "Simple published", precio: 500, stock: 2, estado: "published", usa_variantes: false,
    });
    const draft = await insertProduct(registry, empresaId, {
      nombre: "Simple draft", precio: 500, stock: 10, estado: "draft", usa_variantes: false,
    });
    const withVariants = await insertProduct(registry, empresaId, {
      nombre: "With variants", precio: 800, stock: 0, estado: "published", usa_variantes: true,
    });
    const variantInsert = (talle, stock) => trackedInsert(service, registry, "producto_variante", {
      empresa_id: empresaId, producto_id: withVariants.id, talle, stock, activo: true,
    });
    const variantThree = await variantInsert("M", 3);
    const variantEmpty = await variantInsert("L", 0);
    const foreignDraft = await insertProduct(registry, otherEmpresaId, {
      nombre: "Other company draft", precio: 500, stock: 10, estado: "draft", usa_variantes: false,
    });

    return {
      registry,
      empresaId,
      buyer: { usuarioId: buyer.profileId, addressId: address.id },
      products: { simple: simple.id, draft: draft.id, withVariants: withVariants.id, foreignDraft: foreignDraft.id },
      variants: { three: variantThree.id, empty: variantEmpty.id },
    };
  });
}

function simpleItem(productoId, cantidad) {
  return { producto_id: productoId, variante_id: null, cantidad };
}

function variantItem(f, varianteId, cantidad) {
  return { producto_id: f.products.withVariants, variante_id: varianteId, cantidad };
}

async function attempt(f, items, created) {
  const { data, error } = await service.rpc("crear_pedido_con_items_idempotente", {
    p_usuario_id: f.buyer.usuarioId,
    p_empresa_id: f.empresaId,
    p_direccion_envio_id: f.buyer.addressId,
    p_items: items,
    p_idempotency_key: randomUUID(),
    p_request_fingerprint: randomUUID().replaceAll("-", "").padEnd(64, "0"),
  });
  if (data?.[0]?.pedido_id) created.push(data[0].pedido_id);
  return { pedidoId: data?.[0]?.pedido_id ?? null, error: error?.message ?? null };
}

async function snapshot(f) {
  const count = async (table) => {
    const { count: rows, error } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", f.buyer.usuarioId);
    assert.ifError(error);
    return rows;
  };
  const { data: products, error: productError } = await service
    .from("producto")
    .select("id, stock")
    .in("id", Object.values(f.products))
    .order("id");
  assert.ifError(productError);
  const { data: variants, error: variantError } = await service
    .from("producto_variante")
    .select("id, stock")
    .in("id", Object.values(f.variants))
    .order("id");
  assert.ifError(variantError);
  return {
    pedidos: await count("pedido"),
    idempotencia: await count("checkout_pedido_idempotencia"),
    products,
    variants,
  };
}

async function assertRejectedWithoutSideEffects(f, items, expectedError, created) {
  const before = await snapshot(f);
  const result = await attempt(f, items, created);
  assert.equal(result.error, expectedError, JSON.stringify(items));
  assert.equal(result.pedidoId, null);
  assert.deepEqual(await snapshot(f), before, "a rejected order leaves no order, key or stock change");
}

async function cleanup(f, created) {
  const ids = [...new Set(created)];
  if (ids.length > 0) {
    const { error } = await service.from("pedido").delete().in("id", ids);
    assert.ifError(error);
  }
  await f.registry.cleanup();
}

test("S1: an unpublished product cannot be ordered", async () => {
  const f = await fixture();
  const created = [];
  try {
    await assertRejectedWithoutSideEffects(
      f, [simpleItem(f.products.draft, 1)], "producto_no_disponible", created,
    );
    await assertRejectedWithoutSideEffects(
      f, [simpleItem(f.products.simple, 1), simpleItem(f.products.draft, 1)], "producto_no_disponible", created,
    );
  } finally {
    await cleanup(f, created);
  }
});

test("S1: another company's product fails as foreign before its availability is checked", async () => {
  const f = await fixture();
  const created = [];
  try {
    await assertRejectedWithoutSideEffects(
      f, [simpleItem(f.products.foreignDraft, 1)], "producto_no_pertenece_a_empresa", created,
    );
  } finally {
    await cleanup(f, created);
  }
});

test("S2: a simple product cannot be ordered above its stock, summed across lines", async () => {
  const f = await fixture();
  const created = [];
  try {
    await assertRejectedWithoutSideEffects(
      f, [simpleItem(f.products.simple, 3)], "stock_insuficiente", created,
    );
    await assertRejectedWithoutSideEffects(
      f, [simpleItem(f.products.simple, 1), simpleItem(f.products.simple, 2)], "stock_insuficiente", created,
    );

    const accepted = await attempt(f, [simpleItem(f.products.simple, 2)], created);
    assert.equal(accepted.error, null);
    assert.ok(accepted.pedidoId);
  } finally {
    await cleanup(f, created);
  }
});

test("S2: a variant cannot be ordered above its stock, summed across lines", async () => {
  const f = await fixture();
  const created = [];
  try {
    await assertRejectedWithoutSideEffects(
      f, [variantItem(f, f.variants.three, 4)], "stock_insuficiente", created,
    );
    await assertRejectedWithoutSideEffects(
      f, [variantItem(f, f.variants.three, 2), variantItem(f, f.variants.three, 2)], "stock_insuficiente", created,
    );

    const accepted = await attempt(f, [variantItem(f, f.variants.three, 3)], created);
    assert.equal(accepted.error, null);
    assert.ok(accepted.pedidoId);
  } finally {
    await cleanup(f, created);
  }
});

test("S3: the production drift is realigned, a variant without stock is rejected", async () => {
  const f = await fixture();
  const created = [];
  try {
    await assertRejectedWithoutSideEffects(
      f, [variantItem(f, f.variants.empty, 1)], "variante_sin_stock", created,
    );
  } finally {
    await cleanup(f, created);
  }
});

test("S3: only service_role can execute crear_pedido_con_items", () => {
  const signature = "public.crear_pedido_con_items(uuid, uuid, uuid, jsonb)";
  const privileges = sql(
    ["anon", "authenticated", "service_role"]
      .map((role) => `select '${role}', has_function_privilege('${role}', '${signature}', 'execute')`)
      .join(" union all "),
  );
  assert.equal(privileges, "anon|f\nauthenticated|f\nservice_role|t");
});

test("S4: a valid order keeps the server-side price, its items and the stock untouched", async () => {
  const f = await fixture();
  const created = [];
  try {
    const result = await attempt(
      f, [simpleItem(f.products.simple, 1), variantItem(f, f.variants.three, 2)], created,
    );
    assert.equal(result.error, null);

    const { data: pedido, error: pedidoError } = await service
      .from("pedido")
      .select("estado, total, empresa_id")
      .eq("id", result.pedidoId)
      .single();
    assert.ifError(pedidoError);
    assert.deepEqual(
      { ...pedido, total: Number(pedido.total) },
      { estado: "pendiente_pago", total: 2100, empresa_id: f.empresaId },
    );

    const { data: items, error: itemsError } = await service
      .from("pedido_item")
      .select("producto_id, variante_id, cantidad, precio_unitario")
      .eq("pedido_id", result.pedidoId)
      .order("cantidad");
    assert.ifError(itemsError);
    assert.deepEqual(
      items.map((item) => ({ ...item, precio_unitario: Number(item.precio_unitario) })),
      [
        { producto_id: f.products.simple, variante_id: null, cantidad: 1, precio_unitario: 500 },
        { producto_id: f.products.withVariants, variante_id: f.variants.three, cantidad: 2, precio_unitario: 800 },
      ],
    );

    const after = await snapshot(f);
    assert.equal(after.products.find((row) => row.id === f.products.simple).stock, 2);
    assert.equal(after.variants.find((row) => row.id === f.variants.three).stock, 3);
  } finally {
    await cleanup(f, created);
  }
});
