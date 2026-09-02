import assert from "node:assert/strict";
import test from "node:test";

const tenantModule = await import("../src/lib/storefrontTenant.ts");
const catalogModule = await import("../src/lib/storefrontCatalog.ts").catch(() => ({}));

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const productA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function requireApi(module, name) {
  assert.equal(typeof module[name], "function", `Gate 2 API ${name} must exist`);
  return module[name];
}

function request(host, rawHost = host, extraHeaders = {}) {
  return {
    headers: { ...(host === undefined ? {} : { host }), ...extraHeaders },
    rawHeaders: rawHost === undefined ? [] : ["Host", rawHost],
  };
}

test("extracts exactly one matching direct Host value", () => {
  const extract = requireApi(tenantModule, "extractDirectHost");
  assert.deepEqual(extract(request("SHOP.EXAMPLE.COM", "SHOP.EXAMPLE.COM")), {
    ok: true,
    rawHost: "SHOP.EXAMPLE.COM",
  });

  for (const invalid of [
    { headers: {}, rawHeaders: [] },
    { headers: { host: ["a.test", "b.test"] }, rawHeaders: ["Host", "a.test", "Host", "b.test"] },
    { headers: { host: "a.test" }, rawHeaders: ["Host", "a.test", "host", "a.test"] },
    request("a.test,b.test"),
    request("a.test", "b.test"),
  ]) {
    assert.equal(extract(invalid).ok, false);
  }
});

test("normalizes valid ASCII authorities and DNS boundaries", () => {
  const normalize = requireApi(tenantModule, "normalizeStorefrontHost");
  const label63 = "a".repeat(63);
  const host253 = `${label63}.${label63}.${label63}.${"a".repeat(61)}`;
  for (const [raw, hostname] of [
    ["SHOP.EXAMPLE.COM.:443", "shop.example.com"],
    ["localhost:3000", "localhost"],
    ["127.0.0.1:1", "127.0.0.1"],
    ["shop.example.com:65535", "shop.example.com"],
    [host253, host253],
  ]) {
    assert.deepEqual(normalize(raw), { ok: true, hostname }, raw);
  }
});

test("rejects malformed, ambiguous, non-ASCII, and repaired Host values", () => {
  const normalize = requireApi(tenantModule, "normalizeStorefrontHost");
  const invalid = [
    "", " a.test", "a.test ", "a test", "a\t.test", "a\n.test", "a\u007f.test",
    "tést.example", "https://a.test", "a.test/path", "a.test\\path", "a.test?q=1",
    "a.test#x", "user@a.test", "a%2etest", "[::1]", "a.test,b.test", "a..test",
    "-a.test", "a-.test", "a_test", "a.test..", "a.test:", "a.test:0", "a.test:65536",
    "a.test:+1", "a.test:1.5", "a.test:1:2", `${"a".repeat(64)}.test`, `${"a".repeat(254)}`,
  ];
  for (const raw of invalid) {
    assert.deepEqual(normalize(raw), { ok: false, reason: "invalid_host" }, raw);
  }
});

test("resolver fails closed and never accepts a slug/default company", async () => {
  const resolve = requireApi(tenantModule, "resolveStorefrontTenant");
  let calls = 0;
  const invalid = await resolve(request(undefined, undefined), async () => {
    calls += 1;
    return { data: { empresa_id: tenantA }, error: null };
  });
  assert.deepEqual(invalid, { ok: false, reason: "invalid_host", detail: "missing_host" });
  assert.equal(calls, 0);

  for (const [lookup, expected] of [
    [async () => ({ data: null, error: null }), { ok: false, reason: "unknown_host", hostname: "a.test" }],
    [async () => ({ data: null, error: new Error("down") }), { ok: false, reason: "lookup_failed", hostname: "a.test" }],
    [async () => { throw new Error("down"); }, { ok: false, reason: "lookup_failed", hostname: "a.test" }],
    [async () => ({ data: { empresa_id: "not-a-uuid" }, error: null }), { ok: false, reason: "lookup_failed", hostname: "a.test" }],
  ]) {
    assert.deepEqual(await resolve(request("a.test"), lookup), expected);
  }

  assert.deepEqual(
    await resolve(request("a.test"), async (hostname) => {
      assert.equal(hostname, "a.test");
      return { data: { empresa_id: tenantA }, error: null };
    }),
    { ok: true, tenant: { empresaId: tenantA, hostname: "a.test" } },
  );
  assert.deepEqual(
    await resolve(request("b.test"), async () => ({ data: { empresa_id: tenantB }, error: null })),
    { ok: true, tenant: { empresaId: tenantB, hostname: "b.test" } },
  );
  assert.equal(resolve.length, 2);
});

test("image object paths are bound to resolved company and scoped product", () => {
  const resolvePath = requireApi(catalogModule, "resolveStorefrontImageObjectPath");
  const validA = `empresa/${tenantA}/producto/${productA}/image-a.webp`;
  const validB = `empresa/${tenantB}/producto/${productB}/image-b.webp`;
  const scopedA = new Set([productA]);

  assert.equal(resolvePath(tenantA, scopedA, { producto_id: productA, path: validA, url_imagen: validA }), validA);
  assert.equal(resolvePath(tenantA, scopedA, { producto_id: productA, path: null, url_imagen: validA }), validA);
  for (const row of [
    { producto_id: productA, path: validB, url_imagen: validB },
    { producto_id: productB, path: validA, url_imagen: validA },
    { producto_id: productA, path: validA, url_imagen: `${validA}-different` },
    { producto_id: productA, path: "bad", url_imagen: validA },
    { producto_id: productA, path: "", url_imagen: validA },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/nested/x`, url_imagen: null },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/.`, url_imagen: null },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/..`, url_imagen: null },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/../x`, url_imagen: null },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/x?y`, url_imagen: null },
    { producto_id: productA, path: `empresa/${tenantA}/producto/${productA}/x#y`, url_imagen: null },
    { producto_id: productA, path: `producto-imagenes/${validA}`, url_imagen: null },
    { producto_id: productA, path: `https://cdn.test/${validA}`, url_imagen: null },
  ]) {
    assert.equal(resolvePath(tenantA, scopedA, row), null, JSON.stringify(row));
  }
});

test("catalog scopes every tenant-bearing read and signs only proven ordered images", async () => {
  const load = requireApi(catalogModule, "loadStorefrontCatalog");
  const calls = [];
  const valid = `empresa/${tenantA}/producto/${productA}/valid.webp`;
  const foreign = `empresa/${tenantB}/producto/${productB}/foreign.webp`;
  const rows = {
    producto: [{ id: productA, nombre: "A", descripcion: null, precio: 10, estado: "published", stock: 2 }],
    producto_stock_resumen: [{ producto_id: productA, stock_total: 7, usa_variantes: true }],
    producto_variante: [{ id: "v-a", producto_id: productA, talle: "M", stock: 7 }],
    imagen_producto: [
      { producto_id: productA, path: foreign, url_imagen: foreign, es_principal: true, creado_en: "2026-01-01" },
      { producto_id: productA, path: valid, url_imagen: valid, es_principal: false, creado_en: "2026-01-02" },
    ],
  };
  const signed = [];
  const client = createQueryClient(rows, calls, signed);
  const products = await load(tenantA, client);

  assert.equal(products[0].imagen_url, `signed:${valid}`);
  assert.deepEqual(signed, [valid]);
  assert.ok(calls.some((c) => c.table === "producto" && c.eq.some(([k, v]) => k === "empresa_id" && v === tenantA)));
  assert.ok(calls.some((c) => c.table === "producto_stock_resumen" && c.eq.some(([k, v]) => k === "empresa_id" && v === tenantA)));
  assert.ok(calls.some((c) => c.table === "producto_variante" && c.eq.some(([k, v]) => k === "empresa_id" && v === tenantA) && c.in.some(([k, v]) => k === "producto_id" && v[0] === productA)));
  assert.ok(calls.some((c) => c.table === "imagen_producto" && c.in.some(([k, v]) => k === "producto_id" && v[0] === productA)));
});

test("server orchestration ignores alternate tenant inputs and fails closed with 404/503", async () => {
  const compose = requireApi(catalogModule, "resolveStorefrontServerSideProps");
  const alternateRequest = {
    ...request("a.test", "a.test", {
      "x-forwarded-host": "b.test", origin: "https://b.test", referer: "https://b.test/",
      cookie: `empresa_id=${tenantB}`,
    }),
    body: { empresa_id: tenantB },
  };
  const context = { req: alternateRequest, res: mockResponse(), query: { empresa_id: tenantB, slug: "b", domain: "b.test" } };
  const lookedUp = [];
  const loaded = [];
  const known = await compose(context, {
    findByHostname: async (hostname) => { lookedUp.push(hostname); return { data: { empresa_id: tenantA }, error: null }; },
    loadCatalog: async (empresaId) => { loaded.push(empresaId); return []; },
    logLookupFailure: () => assert.fail("must not log known host"),
  });
  assert.deepEqual(lookedUp, ["a.test"]);
  assert.deepEqual(loaded, [tenantA]);
  assert.deepEqual(known, { props: { empresaId: tenantA, productos: [], error: null } });

  for (const [req, lookupResult, expectedLookupCalls] of [
    [request(undefined, undefined), { data: null, error: null }, 0],
    [request("bad host"), { data: null, error: null }, 0],
    [request("a.test", "b.test"), { data: null, error: null }, 0],
    [request("unknown.test"), { data: null, error: null }, 1],
  ]) {
    let lookupCalls = 0;
    let catalogCalls = 0;
    const result = await compose({ req, res: mockResponse(), query: { empresa_id: tenantB } }, {
      findByHostname: async () => { lookupCalls += 1; return lookupResult; },
      loadCatalog: async () => { catalogCalls += 1; return []; },
      logLookupFailure: () => assert.fail("404 must not log"),
    });
    assert.deepEqual(result, { notFound: true });
    assert.equal(lookupCalls, expectedLookupCalls);
    assert.equal(catalogCalls, 0);
  }

  for (const lookup of [
    async () => ({ data: null, error: new Error("secret") }),
    async () => { throw new Error("secret"); },
    async () => ({ data: { empresa_id: "malformed" }, error: null }),
  ]) {
    const res = mockResponse();
    const logs = [];
    let lookupCalls = 0;
    let catalogCalls = 0;
    const failed = await compose({ req: request("a.test"), res, query: {} }, {
      findByHostname: async (hostname) => { lookupCalls += 1; return lookup(hostname); },
      loadCatalog: async () => { catalogCalls += 1; return []; },
      logLookupFailure: (hostname) => logs.push(hostname),
    });
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.headers, { "Cache-Control": "no-store" });
    assert.deepEqual(logs, ["a.test"]);
    assert.equal(lookupCalls, 1);
    assert.equal(catalogCalls, 0);
    assert.deepEqual(failed, { props: { empresaId: null, productos: [], error: "storefront_unavailable" } });
  }
});

function mockResponse() {
  return { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; } };
}

function createQueryClient(rows, calls, signed) {
  return {
    from(table) {
      const call = { table, eq: [], in: [], is: [], order: [] };
      calls.push(call);
      const query = {
        select() { return query; },
        eq(key, value) { call.eq.push([key, value]); return query; },
        in(key, value) { call.in.push([key, value]); return query; },
        is(key, value) { call.is.push([key, value]); return query; },
        order(key, value) { call.order.push([key, value]); return query; },
        returns() { return Promise.resolve({ data: rows[table] ?? [], error: null }); },
      };
      return query;
    },
    storage: { from() { return { async createSignedUrl(path) { signed.push(path); return { data: { signedUrl: `signed:${path}` }, error: null }; } }; } },
  };
}
