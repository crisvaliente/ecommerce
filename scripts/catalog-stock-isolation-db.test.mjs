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

function localDbQuery(sql) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_ecommerce", "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atc", sql],
    { encoding: "utf8" },
  ).trim();
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
    global: {
      headers: { Authorization: `Bearer ${authenticatedJwt(env.JWT_SECRET, userId)}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const { env, service } = loadGuardedLocalSupabase();

async function createTenantFixture(label, stock) {
  const registry = createCleanupRegistry();
  return runTrackedSetup(registry, async () => {
    const empresaId = await createTrackedCompany(service, registry, `isolation-${label}`);
    const identity = await createTrackedAuthProfile(service, registry, {
      label: `isolation-${label}`,
      empresaId,
      role: "admin",
      onboarding: false,
    });
    const productId = randomUUID();
    const variantId = randomUUID();
    await trackedInsert(service, registry, "producto", {
      id: productId,
      nombre: `Isolation Product ${label}`,
      descripcion: "Cross-tenant stock regression fixture",
      precio: 100,
      stock: 0,
      empresa_id: empresaId,
      estado: "published",
      usa_variantes: true,
    });
    await trackedInsert(service, registry, "producto_variante", {
      id: variantId,
      empresa_id: empresaId,
      producto_id: productId,
      talle: `Size ${label}`,
      stock,
      activo: true,
    });
    return { empresaId, ...identity, productId, variantId, stock, registry };
  });
}

async function cleanupFixture(fixture) {
  await fixture.registry.cleanup();
}

test("PostgREST empresa SELECT uses only canonical usuario tenancy", async () => {
  const tenantA = await createTenantFixture("Empresa A", 13);
  const tenantB = await createTenantFixture("Empresa B", 31);
  const extraRegistry = createCleanupRegistry();
  const legacyOwner = await createTrackedAuthProfile(service, extraRegistry, { label: "legacy-owner" });
  const legacyCreator = await createTrackedAuthProfile(service, extraRegistry, { label: "legacy-creator" });
  const nullCompany = await createTrackedAuthProfile(service, extraRegistry, { label: "null-company" });
  const legacyOwnerId = legacyOwner.authUserId;
  const legacyCreatorId = legacyCreator.authUserId;
  const nullCompanyUserId = nullCompany.authUserId;

  try {
    const { error: legacyFieldsError } = await service
      .from("empresa")
      .upsert([
        {
          id: tenantA.empresaId,
          nombre: "Isolation Empresa A",
          slug: `isolation-empresa-a-${tenantA.empresaId}`,
          owner_auth: legacyOwnerId,
          created_by: tenantB.authUserId,
        },
        {
          id: tenantB.empresaId,
          nombre: "Isolation Empresa B",
          slug: `isolation-empresa-b-${tenantB.empresaId}`,
          owner_auth: tenantA.authUserId,
          created_by: legacyCreatorId,
        },
      ]);
    assert.ifError(legacyFieldsError);

    const fixtureIds = [tenantA.empresaId, tenantB.empresaId];
    const expectedByUser = [
      [tenantA, tenantB],
      [tenantB, tenantA],
    ];
    for (const [own, other] of expectedByUser) {
      const client = authenticatedClient(env, own.authUserId);
      const { data: visible, error: visibleError } = await client
        .from("empresa")
        .select("id")
        .in("id", fixtureIds);
      assert.ifError(visibleError);
      assert.deepEqual(visible, [{ id: own.empresaId }]);

      const { data: crossCompany, error: crossCompanyError } = await client
        .from("empresa")
        .select("id")
        .eq("id", other.empresaId);
      assert.ifError(crossCompanyError);
      assert.deepEqual(crossCompany, []);
    }

    for (const deniedUserId of [legacyOwnerId, legacyCreatorId, randomUUID(), nullCompanyUserId]) {
      const client = authenticatedClient(env, deniedUserId);
      const { data, error } = await client.from("empresa").select("id").in("id", fixtureIds);
      assert.ifError(error);
      assert.deepEqual(data, []);
    }

    const anonResponse = await fetch(`${env.REST_URL}/empresa?select=id&id=in.(${fixtureIds.join(",")})`, {
      headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${env.ANON_KEY}` },
    });
    if (anonResponse.status === 200) {
      assert.deepEqual(await anonResponse.json(), []);
    } else {
      assert.ok([401, 403].includes(anonResponse.status), "anon empresa read must be denied");
    }

    const { data: trustedRows, error: trustedError } = await service
      .from("empresa")
      .select("id")
      .in("id", fixtureIds);
    assert.ifError(trustedError);
    assert.deepEqual(new Set(trustedRows.map(({ id }) => id)), new Set(fixtureIds));
  } finally {
    const { error: legacyFieldsError } = await service
      .from("empresa")
      .update({ owner_auth: null, created_by: null })
      .in("id", [tenantA.empresaId, tenantB.empresaId]);
    assert.ifError(legacyFieldsError);
    await extraRegistry.cleanup();
    await cleanupFixture(tenantA);
    await cleanupFixture(tenantB);
  }
});

test("PostgREST stock view denies anon and isolates two authenticated tenants", async () => {
  assert.equal(
    localDbQuery("select reloptions::text from pg_class where oid = 'public.producto_stock_resumen'::regclass"),
    "{security_invoker=true}",
  );
  assert.equal(
    localDbQuery("select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'producto_stock_resumen' and grantee in ('anon', 'authenticated', 'service_role')"),
    "authenticated:SELECT,service_role:SELECT",
  );

  const tenantA = await createTenantFixture("A", 11);
  const tenantB = await createTenantFixture("B", 29);

  try {
    for (const resource of ["producto_stock_resumen", "producto", "producto_variante"]) {
      const anonResponse = await fetch(`${env.REST_URL}/${resource}?select=*`, {
        headers: {
          apikey: env.ANON_KEY,
          Authorization: `Bearer ${env.ANON_KEY}`,
        },
      });
      assert.ok(
        [401, 403].includes(anonResponse.status),
        `anon ${resource} read unexpectedly returned ${anonResponse.status}: ${await anonResponse.text()}`,
      );
    }

    const { data: trustedRows, error: trustedError } = await service
      .from("producto_stock_resumen")
      .select("producto_id")
      .in("producto_id", [tenantA.productId, tenantB.productId]);
    assert.ifError(trustedError);
    assert.deepEqual(
      new Set(trustedRows.map((row) => row.producto_id)),
      new Set([tenantA.productId, tenantB.productId]),
    );

    for (const [own, other] of [[tenantA, tenantB], [tenantB, tenantA]]) {
      const client = authenticatedClient(env, own.authUserId);
      const { data: visible, error: visibleError } = await client
        .from("producto_stock_resumen")
        .select("empresa_id, producto_id, stock_total, usa_variantes");
      assert.ifError(visibleError);
      assert.deepEqual(visible, [{
        empresa_id: own.empresaId,
        producto_id: own.productId,
        stock_total: own.stock,
        usa_variantes: true,
      }]);

      const { data: crossTenant, error: crossTenantError } = await client
        .from("producto_stock_resumen")
        .select("empresa_id, producto_id, stock_total")
        .eq("empresa_id", other.empresaId);
      assert.ifError(crossTenantError);
      assert.deepEqual(crossTenant, []);

      const { data: sourceRows, error: sourceError } = await client
        .from("producto")
        .select("id, empresa_id")
        .in("id", [own.productId, other.productId]);
      assert.ifError(sourceError);
      assert.deepEqual(sourceRows, [{ id: own.productId, empresa_id: own.empresaId }]);

      const { data: variantRows, error: variantError } = await client
        .from("producto_variante")
        .select("id, empresa_id")
        .in("id", [own.variantId, other.variantId]);
      assert.ifError(variantError);
      assert.deepEqual(variantRows, [{ id: own.variantId, empresa_id: own.empresaId }]);
    }
  } finally {
    await cleanupFixture(tenantA);
    await cleanupFixture(tenantB);
  }
});
