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

function localDbQuery(sql) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_ecommerce", "psql", "-U", "postgres", "-d", "postgres", "-Atc", sql],
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

async function cleanupFixture(fixture) {
  await service.from("producto_variante").delete().eq("id", fixture.variantId);
  await service.from("producto").delete().eq("id", fixture.productId);
  await service.from("usuario").delete().eq("id", fixture.profileId);
  await service.from("empresa").delete().eq("id", fixture.empresaId);
}

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
