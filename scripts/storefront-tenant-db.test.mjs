import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  loadStorefrontCatalog,
  resolveStorefrontServerSideProps,
} from "../src/lib/storefrontCatalog.ts";
import { ensureTenantDomain } from "./lib/tenant-domain.mjs";

function localEnv() {
  const output = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" });
  return Object.fromEntries(output.split("\n").map((line) => line.match(/^([A-Z_]+)="(.*)"$/)).filter(Boolean).map((m) => [m[1], m[2]]));
}

function sql(query) {
  return execFileSync("docker", ["exec", "supabase_db_ecommerce", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atc", query], { encoding: "utf8" }).trim();
}

const env = localEnv();
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function createTenant(label, stock) {
  const empresaId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  const imageId = randomUUID();
  const hostname = `gate2-${label.toLowerCase()}-${empresaId}.test`;
  assert.ifError((await service.from("empresa").insert({ id: empresaId, nombre: `Gate 2 ${label}`, slug: `gate2-${label.toLowerCase()}-${empresaId}` })).error);
  assert.ifError((await service.from("producto").insert({ id: productId, nombre: `Gate 2 Product ${label}`, descripcion: label, precio: stock, stock: 0, empresa_id: empresaId, estado: "published", usa_variantes: true })).error);
  assert.ifError((await service.from("producto_variante").insert({ id: variantId, empresa_id: empresaId, producto_id: productId, talle: `Size ${label}`, stock, activo: true })).error);
  assert.ifError((await service.from("empresa_dominio").insert({ hostname, empresa_id: empresaId })).error);
  return { empresaId, productId, variantId, imageId, hostname, stock };
}

async function cleanup(...fixtures) {
  for (const f of fixtures) await service.from("empresa").delete().eq("id", f.empresaId);
}

async function lookupDomain(hostname) {
  return service.from("empresa_dominio").select("empresa_id").eq("hostname", hostname).maybeSingle();
}

function directHostRequest(hostname, otherHostname) {
  return {
    headers: {
      host: hostname,
      "x-forwarded-host": otherHostname,
      origin: `https://${otherHostname}`,
      referer: `https://${otherHostname}/`,
      cookie: "empresa_id=visitor-supplied",
    },
    rawHeaders: ["Host", hostname],
    body: { empresa_id: "visitor-supplied" },
  };
}

function mockResponse() {
  return { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; } };
}

test("empresa_dominio is normalized, unique, cascading, and least privilege", async () => {
  assert.equal(sql("select relrowsecurity || ':' || relforcerowsecurity from pg_class where oid='public.empresa_dominio'::regclass"), "true:true");
  assert.equal(sql("select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type) from information_schema.role_table_grants where table_schema='public' and table_name='empresa_dominio' and grantee in ('anon','authenticated','service_role')"), "service_role:INSERT,service_role:SELECT");

  const ownerA = randomUUID();
  const ownerB = randomUUID();
  await service.from("empresa").insert([{ id: ownerA, nombre: "Domain A", slug: `domain-a-${ownerA}` }, { id: ownerB, nombre: "Domain B", slug: `domain-b-${ownerB}` }]);
  try {
    for (const hostname of ["UPPER.test", "port.test:443", "trailing.test.", "bad_label.test", "-bad.test", "bad-.test", "a..test", "é.test"]) {
      const { error } = await service.from("empresa_dominio").insert({ hostname, empresa_id: ownerA });
      assert.ok(error, `invalid hostname persisted: ${hostname}`);
    }
    assert.ifError((await service.from("empresa_dominio").insert({ hostname: "owned.test", empresa_id: ownerA })).error);
    const collision = await service.from("empresa_dominio").insert({ hostname: "owned.test", empresa_id: ownerB });
    assert.equal(collision.error?.code, "23505");
    assert.equal((await service.from("empresa_dominio").select("empresa_id").eq("hostname", "owned.test").single()).data.empresa_id, ownerA);

    const anonRead = await anon.from("empresa_dominio").select("hostname");
    assert.ok(anonRead.error);
    assert.equal(sql("select has_table_privilege('authenticated','public.empresa_dominio','select')"), "f");
    assert.equal(sql("select has_table_privilege('anon','public.empresa_dominio','select')"), "f");
    assert.equal(sql("select has_table_privilege('service_role','public.empresa_dominio','update') || ':' || has_table_privilege('service_role','public.empresa_dominio','delete')"), "false:false");

    await service.from("empresa").delete().eq("id", ownerA);
    assert.equal((await service.from("empresa_dominio").select("hostname").eq("hostname", "owned.test")).data.length, 0);
  } finally {
    await service.from("empresa").delete().in("id", [ownerA, ownerB]);
  }
});

test("two mapped hosts retain bidirectional product, variant, stock, and persisted cross-wire evidence", async () => {
  const a = await createTenant("A", 11);
  const b = await createTenant("B", 29);
  const keyA = `empresa/${a.empresaId}/producto/${a.productId}/${a.imageId}.webp`;
  const keyB = `empresa/${b.empresaId}/producto/${b.productId}/${b.imageId}.webp`;
  try {
    assert.ifError((await service.from("imagen_producto").insert([
      { producto_id: a.productId, path: keyB, url_imagen: keyB, es_principal: true, orden: 0 },
      { producto_id: a.productId, path: keyA, url_imagen: keyA, es_principal: false, orden: 1 },
      { producto_id: b.productId, path: keyA, url_imagen: keyA, es_principal: true, orden: 0 },
      { producto_id: b.productId, path: keyB, url_imagen: keyB, es_principal: false, orden: 1 },
    ])).error);

    assert.deepEqual(await ensureTenantDomain(service, a.hostname, a.empresaId), {
      hostname: a.hostname,
      created: false,
    });
    await assert.rejects(
      () => ensureTenantDomain(service, a.hostname, b.empresaId),
      /already belongs to another company/,
    );
    assert.equal((await lookupDomain(a.hostname)).data.empresa_id, a.empresaId);

    for (const [own, other] of [[a, b], [b, a]]) {
      const domain = await lookupDomain(own.hostname);
      assert.ifError(domain.error);
      assert.equal(domain.data.empresa_id, own.empresaId);

      const resolvedIds = [];
      const resolved = await resolveStorefrontServerSideProps(
        {
          req: directHostRequest(own.hostname, other.hostname),
          res: mockResponse(),
          query: { empresa_id: other.empresaId, slug: "other", domain: other.hostname },
        },
        {
          findByHostname: lookupDomain,
          loadCatalog: async (empresaId) => { resolvedIds.push(empresaId); return []; },
          logLookupFailure: () => assert.fail("known DB-backed host must not fail lookup"),
        },
      );
      assert.deepEqual(resolvedIds, [own.empresaId]);
      assert.deepEqual(resolved, { props: { empresaId: own.empresaId, productos: [], error: null } });

      const products = await service.from("producto").select("id,nombre,empresa_id").eq("empresa_id", own.empresaId).eq("estado", "published");
      assert.deepEqual(products.data.map((r) => r.id), [own.productId]);
      assert.ok(!products.data.some((r) => r.id === other.productId));
      const variants = await service.from("producto_variante").select("id,producto_id,empresa_id,talle,stock").eq("empresa_id", own.empresaId).in("producto_id", [own.productId]);
      assert.deepEqual(variants.data.map((r) => [r.id, r.stock]), [[own.variantId, own.stock]]);
      const stock = await service.from("producto_stock_resumen").select("producto_id,empresa_id,stock_total").eq("empresa_id", own.empresaId);
      assert.deepEqual(stock.data.map((r) => [r.producto_id, r.stock_total]), [[own.productId, own.stock]]);
      const images = await service.from("imagen_producto").select("producto_id,path").in("producto_id", [own.productId]);
      assert.equal(images.data.length, 2);
      const signerPaths = [];
      const catalog = await loadStorefrontCatalog(own.empresaId, {
        from: service.from.bind(service),
        storage: { from() { return { async createSignedUrl(path) { signerPaths.push(path); return { data: { signedUrl: `signed:${path}` }, error: null }; } }; } },
      });
      const ownKey = own === a ? keyA : keyB;
      const foreignKey = own === a ? keyB : keyA;
      assert.deepEqual(signerPaths, [ownKey]);
      assert.equal(catalog[0].imagen_url, `signed:${ownKey}`);
      assert.ok(!JSON.stringify(catalog).includes(foreignKey));

      assert.ifError((await service.from("imagen_producto").delete()
        .eq("producto_id", own.productId)
        .eq("path", ownKey)).error);
      const foreignOnlySignerPaths = [];
      const foreignOnlyCatalog = await loadStorefrontCatalog(own.empresaId, {
        from: service.from.bind(service),
        storage: { from() { return { async createSignedUrl(path) { foreignOnlySignerPaths.push(path); return { data: { signedUrl: `signed:${path}` }, error: null }; } }; } },
      });
      assert.deepEqual(foreignOnlySignerPaths, []);
      assert.equal(foreignOnlyCatalog[0].imagen_url, null);
      assert.ok(!JSON.stringify(foreignOnlyCatalog).includes(foreignKey));
    }

    let unknownCatalogCalls = 0;
    const unknown = await resolveStorefrontServerSideProps(
      {
        req: directHostRequest(`unknown-${randomUUID()}.test`, b.hostname),
        res: mockResponse(),
        query: { empresa_id: b.empresaId, slug: "b", domain: b.hostname },
      },
      {
        findByHostname: lookupDomain,
        loadCatalog: async () => { unknownCatalogCalls += 1; return []; },
        logLookupFailure: () => assert.fail("unknown host must be a generic 404"),
      },
    );
    assert.deepEqual(unknown, { notFound: true });
    assert.equal(unknownCatalogCalls, 0);
  } finally {
    await cleanup(a, b);
  }
});
