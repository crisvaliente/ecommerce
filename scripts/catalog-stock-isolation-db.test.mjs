import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

function assertDisposableLocalSupabase(env) {
  assert.equal(
    process.env.ALLOW_LOCAL_SUPABASE_MUTATIONS,
    "1",
    "set ALLOW_LOCAL_SUPABASE_MUTATIONS=1 to run disposable local database tests",
  );

  const apiUrl = new URL(env.API_URL);
  const restUrl = new URL(env.REST_URL);
  assert.equal(apiUrl.protocol, "http:", "local Supabase API must use HTTP");
  assert.equal(apiUrl.hostname, "127.0.0.1", "local Supabase API must use the loopback address");
  assert.equal(apiUrl.port, "55491", "local Supabase API must use the ecommerce port");
  assert.equal(restUrl.origin, apiUrl.origin, "REST and API origins must match");
  assert.equal(restUrl.pathname, "/rest/v1", "unexpected local Supabase REST path");

  const identity = execFileSync(
    "docker",
    [
      "inspect",
      "--format",
      "{{.Name}}|{{.Config.Image}}|{{json .NetworkSettings.Ports}}",
      "supabase_db_ecommerce",
    ],
    { encoding: "utf8" },
  ).trim();
  const [name, image, portsJson] = identity.split("|");
  assert.equal(name, "/supabase_db_ecommerce", "unexpected local database container");
  assert.equal(
    image,
    "public.ecr.aws/supabase/postgres:15.8.1.085",
    "unexpected local database image",
  );
  const databasePorts = JSON.parse(portsJson)["5432/tcp"] ?? [];
  assert.ok(
    databasePorts.some(({ HostPort }) => HostPort === "55476"),
    "local database container is not bound to the ecommerce port",
  );
}

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

const env = localSupabaseEnv();
assertDisposableLocalSupabase(env);
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createTenantFixture(label, stock) {
  const empresaId = randomUUID();
  const authUserId = randomUUID();
  const profileId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();

  const { error: empresaError } = await service.from("empresa").insert({
    id: empresaId,
    nombre: `Isolation ${label}`,
    slug: `isolation-${label.toLowerCase()}-${empresaId}`,
  });
  assert.ifError(empresaError);

  const { error: userError } = await service.from("usuario").insert({
    id: profileId,
    supabase_uid: authUserId,
    nombre: `Isolation ${label}`,
    correo: `isolation-${authUserId}@example.test`,
    rol: "admin",
    empresa_id: empresaId,
    onboarding: false,
  });
  assert.ifError(userError);

  const { error: productError } = await service.from("producto").insert({
    id: productId,
    nombre: `Isolation Product ${label}`,
    descripcion: "Cross-tenant stock regression fixture",
    precio: 100,
    stock: 0,
    empresa_id: empresaId,
    estado: "published",
    usa_variantes: true,
  });
  assert.ifError(productError);

  const { error: variantError } = await service.from("producto_variante").insert({
    id: variantId,
    empresa_id: empresaId,
    producto_id: productId,
    talle: `Size ${label}`,
    stock,
    activo: true,
  });
  assert.ifError(variantError);

  return { empresaId, authUserId, profileId, productId, variantId, stock };
}

async function cleanupFixture(fixture, cleanupErrors = []) {
  for (const [table, id] of [
    ["producto_variante", fixture.variantId],
    ["producto", fixture.productId],
    ["usuario", fixture.profileId],
    ["empresa", fixture.empresaId],
  ]) {
    const { error } = await service.from(table).delete().eq("id", id);
    if (error) cleanupErrors.push(`${table}:${error.code ?? "unknown"}`);
  }
}

async function createAuthIdentity(userId) {
  const { error } = await service.auth.admin.createUser({
    id: userId,
    email: `isolation-${userId}@example.test`,
    email_confirm: true,
  });
  assert.ifError(error);
}

async function createProfile(authUserId, empresaId, label) {
  const profileId = randomUUID();
  const { error } = await service.from("usuario").insert({
    id: profileId,
    supabase_uid: authUserId,
    nombre: `Isolation ${label}`,
    correo: `isolation-${authUserId}@example.test`,
    rol: "admin",
    empresa_id: empresaId,
    onboarding: empresaId === null,
  });
  assert.ifError(error);
  return profileId;
}

test("PostgREST empresa SELECT uses only canonical usuario tenancy", async () => {
  const tenantA = await createTenantFixture("Empresa A", 13);
  const tenantB = await createTenantFixture("Empresa B", 31);
  const legacyOwnerId = randomUUID();
  const legacyCreatorId = randomUUID();
  const nullCompanyUserId = randomUUID();
  const authFixtureIds = [
    tenantA.authUserId,
    tenantB.authUserId,
    legacyOwnerId,
    legacyCreatorId,
  ];
  const createdAuthUserIds = [];
  let nullCompanyProfileId;

  try {
    for (const authUserId of authFixtureIds) {
      await createAuthIdentity(authUserId);
      createdAuthUserIds.push(authUserId);
    }

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
    nullCompanyProfileId = await createProfile(nullCompanyUserId, null, "Null Company");

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
    const cleanupErrors = [];
    if (nullCompanyProfileId) {
      const { error } = await service.from("usuario").delete().eq("id", nullCompanyProfileId);
      if (error) cleanupErrors.push(`usuario:${error.code ?? "unknown"}`);
    }
    const { error: authProfilesError } = await service
      .from("usuario")
      .delete()
      .in("supabase_uid", authFixtureIds);
    if (authProfilesError) cleanupErrors.push(`usuario:${authProfilesError.code ?? "unknown"}`);

    const { error: legacyFieldsError } = await service
      .from("empresa")
      .update({ owner_auth: null, created_by: null })
      .in("id", [tenantA.empresaId, tenantB.empresaId]);
    if (legacyFieldsError) cleanupErrors.push(`empresa:${legacyFieldsError.code ?? "unknown"}`);

    await cleanupFixture(tenantA, cleanupErrors);
    await cleanupFixture(tenantB, cleanupErrors);
    for (const authUserId of createdAuthUserIds) {
      const { error } = await service.auth.admin.deleteUser(authUserId);
      if (error) cleanupErrors.push(`auth.users:${error.code ?? "unknown"}`);
    }
    assert.deepEqual(cleanupErrors, [], `fixture cleanup failed: ${cleanupErrors.join(", ")}`);
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
