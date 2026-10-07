import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

const STORAGE_BUCKET = "producto-imagenes";

function localDbQuery(sql) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_ecommerce", "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atc", sql],
    { encoding: "utf8" },
  ).trim();
}

function storageTransportPath(storedKey) {
  return storedKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function returnedStoredKey(result, expectedKey) {
  return result.data?.fullPath === `${STORAGE_BUCKET}/${expectedKey}`;
}

async function ownedStorageNames(prefix) {
  const { data, error } = await service.storage.from(STORAGE_BUCKET).list(prefix, { limit: 100 });
  assert.ifError(error);
  return new Set(data.map(({ name }) => name));
}

function storageRejectionEvidence(error) {
  const own = (name) => Object.prototype.hasOwnProperty.call(error, name);
  const normalizeStatus = (value) => {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && /^(?:[1-9][0-9]{2})$/.test(value)) return Number(value);
    return null;
  };
  const statuses = ["status", "statusCode"].filter(own).map((name) => normalizeStatus(error[name]));
  const status = statuses.length === 1 || statuses.every((value) => value === statuses[0]) ? statuses[0] ?? null : null;
  const semantic = [error.code, error.message, error.error].filter((value) => typeof value === "string").join(" ");
  const invalidKey = /(?:^|\W)invalid key(?:\W|$)/i.test(semantic);
  const permission = error.code === "42501" || /(?:row-level security|permission denied|not authorized)/i.test(semantic);
  const knownErrorClass = status === 400 && invalidKey ? "api-invalid-key"
    : [400, 401, 403].includes(status) && permission ? "permission-denial" : "unknown";
  return { status, statusFieldCount: statuses.length, conflictingStatuses: statuses.length > 1 && status === null, knownErrorClass };
}

function storageSnapshot(fixture, intendedKey) {
  const prefixes = [fixture.empresaA, fixture.empresaB].flatMap((company) =>
    [fixture.productA.id, fixture.productB.id].map((product) => `empresa/${company}/producto/${product}/%`),
  ).map((prefix) => `'${prefix}'`).join(",");
  const encodedKey = Buffer.from(intendedKey).toString("base64");
  return localDbQuery(`select count(*) || ':' || coalesce(md5(string_agg(name, ',' order by name)), '') || ':' || (select count(*) from storage.objects where bucket_id='${STORAGE_BUCKET}' and name=convert_from(decode('${encodedKey}','base64'),'utf8')) from storage.objects where bucket_id='${STORAGE_BUCKET}' and name like any(array[${prefixes}])`);
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function registerExactStorageCleanup(registry, storedKey, before) {
  assert.ok(before.endsWith(":0"), "fresh fixture storage key must be absent before cleanup registration");
  registry.register("storage:negative-attempt", async () => {
    localDbQuery(`delete from storage.objects where bucket_id=${sqlLiteral(STORAGE_BUCKET)} and name=${sqlLiteral(storedKey)}`);
  });
}

function authenticatedJwt(secret, userId) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
    sub: userId,
  });
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function authenticatedClient(env, userId) {
  return createClient(env.API_URL, env.ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authenticatedJwt(env.JWT_SECRET, userId)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function graphqlProductIds(userId) {
  const response = await fetch(`${env.API_URL}/graphql/v1`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${authenticatedJwt(env.JWT_SECRET, userId)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "query { productoCollection { edges { node { id } } } }",
    }),
  });
  assert.equal(response.status, 200, "local GraphQL facade must be available");
  const body = await response.json();
  assert.deepEqual(body.errors, undefined, `GraphQL facade failed: ${JSON.stringify(body.errors)}`);
  return new Set(body.data.productoCollection.edges.map(({ node }) => node.id));
}

const { env, service } = loadGuardedLocalSupabase();
const anon = createClient(env.API_URL, env.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createFixture(label) {
  const registry = createCleanupRegistry();
  return runTrackedSetup(registry, async () => {
    const empresaA = await createTrackedCompany(service, registry, `${label}-a`);
    const empresaB = await createTrackedCompany(service, registry, `${label}-b`);
    const identities = {};
    for (const [name, empresaId, role] of [
      ["adminA", empresaA, "admin"],
      ["staffA", empresaA, "staff"],
      ["clienteA", empresaA, "cliente"],
      ["adminB", empresaB, "admin"],
      ["clienteNull", null, "cliente"],
    ]) {
      identities[name] = await createTrackedAuthProfile(service, registry, {
        label: `${label}-${name}`,
        empresaId,
        role,
        onboarding: empresaId === null,
      });
    }

    const categoryA = await trackedInsert(service, registry, "categoria", {
      id: randomUUID(), empresa_id: empresaA, nombre: `${label} category A`,
    });
    const categoryA2 = await trackedInsert(service, registry, "categoria", {
      id: randomUUID(), empresa_id: empresaA, nombre: `${label} category A2`,
    });
    const categoryB = await trackedInsert(service, registry, "categoria", {
      id: randomUUID(), empresa_id: empresaB, nombre: `${label} category B`,
    });
    const productA = await trackedInsert(service, registry, "producto", {
      id: randomUUID(), empresa_id: empresaA, categoria_id: null,
      nombre: `${label} product A`, descripcion: "P3 catalog fixture", precio: 10,
      stock: 4, estado: "published", usa_variantes: true,
    });
    const productB = await trackedInsert(service, registry, "producto", {
      id: randomUUID(), empresa_id: empresaB, categoria_id: null,
      nombre: `${label} product B`, descripcion: "P3 catalog fixture", precio: 20,
      stock: 6, estado: "published", usa_variantes: true,
    });
    const bridgeA = await trackedInsert(service, registry, "producto_categoria", {
      empresa_id: empresaA, producto_id: productA.id, categoria_id: categoryA.id,
    }, "producto_id");
    const variantA = await trackedInsert(service, registry, "producto_variante", {
      id: randomUUID(), empresa_id: empresaA, producto_id: productA.id,
      talle: `${label}-size`, stock: 4, activo: true,
    });
    const imageA = await trackedInsert(service, registry, "imagen_producto", {
      id: randomUUID(), producto_id: productA.id,
      url_imagen: `https://example.test/${label}.jpg`, path: `${label}.jpg`, orden: 1,
    });

    return {
      registry, empresaA, empresaB, identities,
      categoryA, categoryA2, categoryB, productA, productB, bridgeA, variantA, imageA,
    };
  });
}

async function withFixture(label, run) {
  const fixture = await createFixture(label);
  try {
    await run(fixture);
  } finally {
    await fixture.registry.cleanup();
  }
}

function catalogRows(fixture) {
  return [
    { table: "producto", id: fixture.productA.id, insert: {
      id: randomUUID(), empresa_id: fixture.empresaA, nombre: "Denied product",
      descripcion: "must not persist", precio: 1, stock: 0, estado: "draft", usa_variantes: false,
    }, update: { nombre: "mutated" } },
    { table: "categoria", id: fixture.categoryA.id, insert: {
      id: randomUUID(), empresa_id: fixture.empresaA, nombre: "Denied category",
    }, update: { nombre: "mutated" } },
    { table: "producto_categoria", id: fixture.productA.id, key: "producto_id", insert: {
      empresa_id: fixture.empresaA, producto_id: fixture.productA.id,
      categoria_id: fixture.categoryA2.id,
    }, update: { categoria_id: fixture.categoryA2.id } },
    { table: "producto_variante", id: fixture.variantA.id, insert: {
      id: randomUUID(), empresa_id: fixture.empresaA, producto_id: fixture.productA.id,
      talle: `denied-${randomUUID()}`, stock: 1, activo: true,
    }, update: { stock: 91 } },
    { table: "imagen_producto", id: fixture.imageA.id, insert: {
      id: randomUUID(), producto_id: fixture.productA.id,
      url_imagen: "https://example.test/denied.jpg", path: "denied.jpg", orden: 9,
    }, update: { descripcion: "mutated" } },
  ];
}

async function assertRowUnchanged(table, key, id, before) {
  const { data, error } = await service.from(table).select("*").eq(key, id).single();
  assert.ifError(error);
  assert.deepEqual(data, before);
}

async function assertCatalogDenied(client, fixture, rows = catalogRows(fixture)) {
  const unexpectedReads = [];
  for (const row of rows) {
    const key = row.key ?? "id";
    const { data: before, error: beforeError } = await service
      .from(row.table).select("*").eq(key, row.id).single();
    assert.ifError(beforeError);

    const selected = await client.from(row.table).select(key).eq(key, row.id);
    if (!selected.error && selected.data.length !== 0) unexpectedReads.push(row.table);

    const inserted = await client.from(row.table).insert(row.insert).select(key);
    assert.ok(inserted.error || inserted.data?.length === 0, `${row.table} INSERT must be denied`);
    const updated = await client.from(row.table).update(row.update).eq(key, row.id).select(key);
    assert.ok(updated.error || updated.data?.length === 0, `${row.table} UPDATE must affect no row`);
    const deleted = await client.from(row.table).delete().eq(key, row.id).select(key);
    assert.ok(deleted.error || deleted.data?.length === 0, `${row.table} DELETE must affect no row`);
    await assertRowUnchanged(row.table, key, row.id, before);
  }
  assert.deepEqual(unexpectedReads, [], "catalog SELECT must expose no denied rows");
}

async function exerciseCatalogCrud(client, fixture, actorLabel) {
  const categoryOne = randomUUID();
  const categoryTwo = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  const imageId = randomUUID();

  for (const values of [
    { id: categoryOne, empresa_id: fixture.empresaA, nombre: `${actorLabel} one` },
    { id: categoryTwo, empresa_id: fixture.empresaA, nombre: `${actorLabel} two` },
  ]) {
    const result = await client.from("categoria").insert(values).select("id").single();
    assert.ifError(result.error);
  }
  const product = await client.from("producto").insert({
    id: productId, empresa_id: fixture.empresaA, categoria_id: null,
    nombre: `${actorLabel} product`, descripcion: "CRUD control", precio: 30,
    stock: 3, estado: "draft", usa_variantes: true,
  }).select("id").single();
  assert.ifError(product.error);
  assert.ifError((await client.from("producto_categoria").insert({
    empresa_id: fixture.empresaA, producto_id: productId, categoria_id: categoryOne,
  })).error);
  assert.ifError((await client.from("producto_variante").insert({
    id: variantId, empresa_id: fixture.empresaA, producto_id: productId,
    talle: actorLabel, stock: 3, activo: true,
  })).error);
  assert.ifError((await client.from("imagen_producto").insert({
    id: imageId, producto_id: productId,
    url_imagen: `https://example.test/${actorLabel}.jpg`, path: `${actorLabel}.jpg`, orden: 0,
  })).error);

  for (const [table, key, id] of [
    ["producto", "id", productId], ["categoria", "id", categoryOne],
    ["producto_categoria", "producto_id", productId], ["producto_variante", "id", variantId],
    ["imagen_producto", "id", imageId],
  ]) {
    const visible = await client.from(table).select(key).eq(key, id);
    assert.ifError(visible.error);
    assert.equal(visible.data.length, 1, `${actorLabel} must SELECT ${table}`);
  }

  assert.ifError((await client.from("producto").update({ nombre: `${actorLabel} updated` }).eq("id", productId)).error);
  assert.ifError((await client.from("categoria").update({ nombre: `${actorLabel} updated` }).eq("id", categoryOne)).error);
  assert.ifError((await client.from("producto_categoria").update({ categoria_id: categoryTwo }).eq("producto_id", productId)).error);
  assert.ifError((await client.from("producto_variante").update({ stock: 8 }).eq("id", variantId)).error);
  assert.ifError((await client.from("imagen_producto").update({ descripcion: "updated" }).eq("id", imageId)).error);

  for (const [table, key, id] of [
    ["imagen_producto", "id", imageId], ["producto_variante", "id", variantId],
    ["producto_categoria", "producto_id", productId], ["producto", "id", productId],
    ["categoria", "id", categoryOne], ["categoria", "id", categoryTwo],
  ]) {
    const removed = await client.from(table).delete().eq(key, id).select(key);
    assert.ifError(removed.error);
    assert.equal(removed.data.length, 1, `${actorLabel} must DELETE ${table}`);
  }
}

test("same-company admin and staff have CRUD on every catalog table", async (t) => {
  for (const role of ["adminA", "staffA"]) {
    await t.test(role, async () => withFixture(`crud-${role}`, async (fixture) => {
      await exerciseCatalogCrud(
        authenticatedClient(env, fixture.identities[role].authUserId), fixture, role,
      );
    }));
  }
});

test("cliente, anon, and cross-company admin cannot read or mutate catalog rows", async (t) => {
  for (const [label, clientFor] of [
    ["bound cliente", (f) => authenticatedClient(env, f.identities.clienteA.authUserId)],
    ["null-company cliente", (f) => authenticatedClient(env, f.identities.clienteNull.authUserId)],
    ["cross-company admin", (f) => authenticatedClient(env, f.identities.adminB.authUserId)],
    ["anon", () => anon],
  ]) {
    for (const table of ["producto", "categoria", "producto_categoria", "producto_variante", "imagen_producto"]) {
      await t.test(`${label}: ${table}`, async () => withFixture(`denied-${label}-${table}`, async (fixture) => {
        await assertCatalogDenied(
          clientFor(fixture), fixture, catalogRows(fixture).filter((row) => row.table === table),
        );
      }));
    }
  }
});

test("catalog view and identity tables enforce the complete browser matrix", async () => {
  await withFixture("identity-matrix", async (fixture) => {
    const admin = authenticatedClient(env, fixture.identities.adminA.authUserId);
    const staff = authenticatedClient(env, fixture.identities.staffA.authUserId);
    const cliente = authenticatedClient(env, fixture.identities.clienteA.authUserId);

    for (const client of [admin, staff]) {
      const stock = await client.from("producto_stock_resumen")
        .select("producto_id").eq("producto_id", fixture.productA.id);
      assert.ifError(stock.error);
      assert.deepEqual(stock.data, [{ producto_id: fixture.productA.id }]);
    }
    const unexpectedStockReaders = [];
    for (const [label, client] of [["cliente", cliente], ["anon", anon]]) {
      const stock = await client.from("producto_stock_resumen").select("producto_id")
        .eq("producto_id", fixture.productA.id);
      if (!stock.error && stock.data.length !== 0) unexpectedStockReaders.push(label);
    }

    for (const identity of Object.values(fixture.identities)) {
      const client = authenticatedClient(env, identity.authUserId);
      const self = await client.from("usuario").select("id").eq("id", identity.profileId);
      assert.ifError(self.error);
      assert.deepEqual(self.data, [{ id: identity.profileId }]);
      const mutation = await client.from("usuario").update({ nombre: "forbidden" })
        .eq("id", identity.profileId).select("id");
      assert.ok(mutation.error || mutation.data.length === 0);
    }

    const ownCompany = await cliente.from("empresa").select("id").eq("id", fixture.empresaA);
    assert.ifError(ownCompany.error);
    assert.deepEqual(ownCompany.data, [{ id: fixture.empresaA }]);
    const exposedTrustedTables = [];
    for (const table of ["membresia", "historial_stock"]) {
      if (!(await cliente.from(table).select("*").limit(1)).error) exposedTrustedTables.push(table);
    }
    assert.deepEqual(
      { unexpectedStockReaders, exposedTrustedTables },
      { unexpectedStockReaders: [], exposedTrustedTables: [] },
      "browser identities must not read stock view or trusted-only tables",
    );
  });
});

test("GraphQL facade applies own-company and cross-company catalog policies", async () => {
  await withFixture("graphql", async (fixture) => {
    for (const [identity, expected, denied] of [
      [fixture.identities.adminA, fixture.productA.id, fixture.productB.id],
      [fixture.identities.staffA, fixture.productA.id, fixture.productB.id],
      [fixture.identities.adminB, fixture.productB.id, fixture.productA.id],
    ]) {
      const ids = await graphqlProductIds(identity.authUserId);
      assert.equal(ids.has(expected), true);
      assert.equal(ids.has(denied), false);
    }
    const clienteIds = await graphqlProductIds(fixture.identities.clienteA.authUserId);
    assert.equal(clienteIds.has(fixture.productA.id), false, "cliente must not read catalog via GraphQL");
  });
});

test("browser roles cannot mutate empresa or usuario and persisted rows remain unchanged", async (t) => {
  for (const role of ["adminA", "staffA", "clienteA"]) {
    await t.test(role, async () => withFixture(`identity-commands-${role}`, async (fixture) => {
      const identity = fixture.identities[role];
      const client = authenticatedClient(env, identity.authUserId);
      const ownCompany = await client.from("empresa").select("id").eq("id", fixture.empresaA);
      assert.ifError(ownCompany.error);
      assert.deepEqual(ownCompany.data, [{ id: fixture.empresaA }]);
      const companyBefore = await service.from("empresa").select("id, nombre")
        .eq("id", fixture.empresaA).single();
      assert.ifError(companyBefore.error);
      const companyUpdate = await client.from("empresa").update({ nombre: "forbidden" })
        .eq("id", fixture.empresaA).select("id");
      if (!companyUpdate.error && companyUpdate.data.length !== 0) {
        await service.from("empresa").update({ nombre: companyBefore.data.nombre }).eq("id", fixture.empresaA);
      }
      assert.ok(companyUpdate.error || companyUpdate.data.length === 0);
      const companyDelete = await client.from("empresa").delete().eq("id", fixture.empresaA).select("id");
      assert.equal(companyDelete.error?.code, "42501");
      assert.deepEqual(
        (await service.from("empresa").select("id, nombre").eq("id", fixture.empresaA).single()).data,
        companyBefore.data,
      );

      const profileBefore = await service.from("usuario").select("id, nombre")
        .eq("id", identity.profileId).single();
      assert.ifError(profileBefore.error);
      for (const operation of [
        client.from("usuario").update({ nombre: "forbidden" }).eq("id", identity.profileId).select("id"),
        client.from("usuario").delete().eq("id", identity.profileId).select("id"),
      ]) {
        const result = await operation;
        assert.ok(result.error || result.data.length === 0);
      }
      assert.deepEqual(
        (await service.from("usuario").select("id, nombre").eq("id", identity.profileId).single()).data,
        profileBefore.data,
      );
    }));
  }
});

test("membresia and historial_stock deny every browser identity without mutation", async () => {
  await withFixture("trusted-tables", async (fixture) => {
    await trackedInsert(service, fixture.registry, "membresia", {
      empresa_id: fixture.empresaA, usuario_id: fixture.identities.clienteA.profileId,
    }, "empresa_id");
    const history = await trackedInsert(service, fixture.registry, "historial_stock", {
      id: randomUUID(), producto_id: fixture.productA.id, cantidad: 1, motivo: "P3 fixture",
    });
    for (const identity of [
      fixture.identities.adminA, fixture.identities.staffA, fixture.identities.clienteA,
    ]) {
      const client = authenticatedClient(env, identity.authUserId);
      for (const [table, key, id, values] of [
        ["membresia", "empresa_id", fixture.empresaA, { rol: "invitado" }],
        ["historial_stock", "id", history.id, { motivo: "forbidden" }],
      ]) {
        const before = await service.from(table).select("*").eq(key, id).single();
        assert.ifError(before.error);
        const read = await client.from(table).select(key).eq(key, id);
        assert.ok(read.error || read.data.length === 0);
        const update = await client.from(table).update(values).eq(key, id).select(key);
        assert.ok(update.error || update.data.length === 0);
        const deletion = await client.from(table).delete().eq(key, id).select(key);
        assert.ok(deletion.error || deletion.data.length === 0);
        assert.deepEqual((await service.from(table).select("*").eq(key, id).single()).data, before.data);
      }
    }
  });
});

test("soft delete is guarded and denied calls preserve the image", async () => {
  await withFixture("soft-delete", async (fixture) => {
    const imageState = async () => {
      const { data, error } = await service.from("imagen_producto")
        .select("deleted_at, es_principal").eq("id", fixture.imageA.id).single();
      assert.ifError(error);
      return data;
    };
    const before = await imageState();
    for (const identity of [fixture.identities.clienteA, fixture.identities.adminB]) {
      const denied = await authenticatedClient(env, identity.authUserId)
        .rpc("soft_delete_imagen_producto", { p_imagen_id: fixture.imageA.id });
      assert.equal(denied.error?.code, "42501");
      assert.deepEqual(await imageState(), before);
    }
    const allowed = await authenticatedClient(env, fixture.identities.staffA.authUserId)
      .rpc("soft_delete_imagen_producto", { p_imagen_id: fixture.imageA.id });
    assert.ifError(allowed.error);
    assert.ok((await imageState()).deleted_at);
  });
});

test("product category composite FK denies cross-company references and permits null", async () => {
  await withFixture("category-fk", async (fixture) => {
    const crossId = randomUUID();
    const cross = await service.from("producto").insert({
      id: crossId, empresa_id: fixture.empresaA, categoria_id: fixture.categoryB.id,
      nombre: "Cross category", descripcion: "must fail", precio: 1,
      stock: 0, estado: "draft", usa_variantes: false,
    });
    assert.equal(cross.error?.code, "23503");
    const missing = await service.from("producto").insert({
      id: randomUUID(), empresa_id: fixture.empresaA, categoria_id: randomUUID(),
      nombre: "Missing category", descripcion: "must fail", precio: 1,
      stock: 0, estado: "draft", usa_variantes: false,
    });
    assert.equal(missing.error?.code, "23503");
    const nullable = await trackedInsert(service, fixture.registry, "producto", {
      id: randomUUID(), empresa_id: fixture.empresaA, categoria_id: null,
      nombre: "Null category", descripcion: "allowed", precio: 1,
      stock: 0, estado: "draft", usa_variantes: false,
    });
    assert.ok(nullable.id);
  });
});

test("private storage accepts only the exact tenant/product key grammar", async () => {
  await withFixture("storage", async (fixture) => {
    const admin = authenticatedClient(env, fixture.identities.adminA.authUserId);
    const prefix = `empresa/${fixture.empresaA}/producto/${fixture.productA.id}`;
    fixture.registry.register("storage objects for fresh fixture products", async () => {
      localDbQuery(`delete from storage.objects where bucket_id='producto-imagenes'
        and split_part(name,'/',2) in ('${fixture.empresaA}','${fixture.empresaB}')
        and split_part(name,'/',4) in ('${fixture.productA.id}','${fixture.productB.id}')`);
    });
    const valid = `${prefix}/valid-${randomUUID()}.txt`;
    const validKeys = [valid, `${prefix}/foto.jpg`, `${prefix}/foto.v2.png`];
    for (const key of validKeys) {
      const uploaded = await admin.storage.from(STORAGE_BUCKET).upload(key, "fixture");
      assert.ifError(uploaded.error);
      assert.equal(returnedStoredKey(uploaded, key), true, "valid upload must preserve the exact raw stored key");
      fixture.registry.register("storage:valid", async () => {
        const { error } = await service.storage.from(STORAGE_BUCKET).remove([key]);
        if (error) throw error;
      });
    }
    const persistedValidNames = await ownedStorageNames(prefix);
    for (const key of validKeys) {
      assert.ok(persistedValidNames.has(key.slice(prefix.length + 1)), "valid upload must persist");
    }

    const signed = await service.storage.from("producto-imagenes").createSignedUrl(valid, 60);
    assert.ifError(signed.error);
    assert.match(signed.data.signedUrl, /token=/);
    const visible = await admin.storage.from("producto-imagenes").list(prefix);
    assert.ifError(visible.error);
    for (const key of validKeys) {
      assert.ok(visible.data.some(({ name }) => key.endsWith(`/${name}`)), "valid upload must be listed");
    }

    const deniedStoredKeys = [
      ["wrong-company", `empresa/${fixture.empresaB}/producto/${fixture.productA.id}/wrong-company.txt`, "permission-denial"],
      ["wrong-product", `empresa/${fixture.empresaA}/producto/${fixture.productB.id}/wrong-product.txt`, "permission-denial"],
      ["missing-segment", `empresa/${fixture.empresaA}/producto/${fixture.productA.id}`, "api-invalid-key"],
      ["extra-segment", `empresa/${fixture.empresaA}/extra/producto/${fixture.productA.id}/too-many.txt`, "api-invalid-key"],
      ["bad-company-id", `empresa/not-a-uuid/producto/${fixture.productA.id}/bad-company.txt`, "api-invalid-key"],
      ["bad-product-id", `empresa/${fixture.empresaA}/producto/not-a-uuid/bad-product.txt`, "api-invalid-key"],
      ["query-marker", `${prefix}/query?.txt`, "api-invalid-key"],
      ["fragment-marker", `${prefix}/fragment#.txt`, "api-invalid-key"],
      ["backslash", `${prefix}/back\\slash.txt`, "api-invalid-key"],
      ["control-character", `${prefix}/control-${String.fromCharCode(1)}.txt`, "api-invalid-key"],
    ];
    const storageFailures = [];
    for (const [label, storedKey, expectedClass] of deniedStoredKeys) {
      const before = storageSnapshot(fixture, storedKey);
      registerExactStorageCleanup(fixture.registry, storedKey, before);
      const result = await admin.storage.from(STORAGE_BUCKET).upload(storageTransportPath(storedKey), "denied");
      const after = storageSnapshot(fixture, storedKey);
      const evidence = result.error ? storageRejectionEvidence(result.error) : null;
      const outcome = {
        label, status: evidence?.status ?? null, statusFieldCount: evidence?.statusFieldCount ?? 0,
        knownErrorClass: evidence?.knownErrorClass ?? "unexpected-success",
        noSuccess: Boolean(result.error), fullPathMatches: returnedStoredKey(result, storedKey),
        scopedStateUnchanged: before === after, rawKeyAbsent: after.endsWith(":0"),
      };
      const classMatches = expectedClass === "api-invalid-key"
        ? ["api-invalid-key", "permission-denial"].includes(outcome.knownErrorClass)
        : outcome.knownErrorClass === "permission-denial";
      if (!outcome.noSuccess || !outcome.scopedStateUnchanged || !outcome.rawKeyAbsent || !classMatches
        || evidence?.conflictingStatuses) storageFailures.push(outcome);
    }

    const traversalKeys = [
      `${prefix}/.`,
      `${prefix}/..`,
      `${prefix}/../traversal.txt`,
    ];
    for (const key of traversalKeys) {
      const url = new URL(`/storage/v1/object/${STORAGE_BUCKET}/${key}`, env.API_URL);
      assert.equal(
        url.pathname !== `/storage/v1/object/${STORAGE_BUCKET}/${key}`,
        true,
        "literal dot transport paths are normalized before storage evaluates a key",
      );
    }

    const update = await admin.storage.from("producto-imagenes").update(valid, "changed");
    assert.ok(update.error, "storage UPDATE must have no authenticated policy");
    for (const [label, client] of [
      ["cliente", authenticatedClient(env, fixture.identities.clienteA.authUserId)],
      ["cross-company admin", authenticatedClient(env, fixture.identities.adminB.authUserId)],
      ["anon", anon],
    ]) {
      const deniedKey = `${prefix}/denied-${randomUUID()}.txt`;
      registerExactStorageCleanup(fixture.registry, deniedKey, storageSnapshot(fixture, deniedKey));
      assert.ok((await client.storage.from("producto-imagenes").upload(deniedKey, "denied")).error);
      const listed = await client.storage.from("producto-imagenes").list(prefix);
      assert.ok(listed.error || listed.data.every(({ name }) => !valid.endsWith(`/${name}`)), `${label} SELECT`);
      await client.storage.from("producto-imagenes").remove([valid]);
      const trustedCheck = await service.storage.from("producto-imagenes").list(prefix);
      assert.ifError(trustedCheck.error);
      assert.ok(trustedCheck.data.some(({ name }) => valid.endsWith(`/${name}`)), `${label} DELETE persisted`);
    }
    assert.deepEqual(storageFailures, [], "storage denials must have a known layer and preserve every scoped raw key state");
  });
});

test("client SQL table permissions deny identity and trusted-table writes", () => {
  assert.equal(
    localDbQuery("select bool_and(not has_table_privilege('authenticated', format('public.%I', table_name), privilege)) from unnest(array['empresa','usuario','membresia','historial_stock']) table_name cross join unnest(array['INSERT','UPDATE','DELETE']) privilege"),
    "t",
  );
});

test("effective ACL metadata preserves commerce helpers and narrows catalog dependencies", () => {
  assert.equal(
    localDbQuery("select reloptions::text from pg_class where oid = 'public.producto_stock_resumen'::regclass"),
    "{security_invoker=true}",
  );
  assert.equal(
    localDbQuery("select count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public' and table_name in ('membresia','historial_stock')"),
    "0",
  );
  assert.equal(
    localDbQuery("select count(*) from information_schema.routine_privileges where grantee='authenticated' and routine_schema='public' and routine_name in ('owns_carrito','owns_pedido')"),
    "2",
  );
  assert.equal(
    localDbQuery("select count(*) from information_schema.routine_privileges where grantee in ('PUBLIC','anon','authenticated') and routine_schema='public' and routine_name in ('ensure_personal_org','user_is_member_of','current_empresa_id','uid','is_empresa_owner','handle_new_auth_user')"),
    "0",
  );
  assert.equal(
    localDbQuery("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='graphql_public' and p.oid=to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)')"),
    "1",
  );
});
