import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const PEDIDO_FILE = new URL("../src/pages/api/ecommerce/pedido.ts", import.meta.url);
const STORE_REQUEST_FILE = new URL("../src/lib/storeRequest.ts", import.meta.url).pathname;
const API_SECURITY_FILE = new URL("../src/lib/apiSecurity.ts", import.meta.url).pathname;

const STORE_A = { hostname: "raeyz.com", empresaId: "11111111-1111-4111-8111-111111111111" };
const STORE_B = { hostname: "ferreteria.example", empresaId: "22222222-2222-4222-8222-222222222222" };
const DIRECCION_ID = "33333333-3333-4333-8333-333333333333";
const PEDIDO_ID = "44444444-4444-4444-8444-444444444444";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";
const ITEMS = [{ producto_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cantidad: 1 }];

function request({ host = STORE_A.hostname, headers = {}, body } = {}) {
  return {
    method: "POST",
    headers: { host, authorization: "Bearer buyer-token", "idempotency-key": IDEMPOTENCY_KEY, ...headers },
    rawHeaders: ["Host", host],
    body: body ?? { empresa_id: STORE_A.empresaId, direccion_envio_id: DIRECCION_ID, items: ITEMS },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function dependencies({ rpcResult, stores = [STORE_A, STORE_B], lookupError = null }) {
  const calls = { lookups: [], rpc: [] };
  const authClient = {
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: async () => ({ data: { id: "usuario-1" }, error: null }),
      };
    },
  };
  const supabaseServer = {
    from(table) {
      assert.equal(table, "empresa_dominio");
      let hostname = null;
      return {
        select() { return this; },
        eq(column, value) { hostname = value; return this; },
        async maybeSingle() {
          calls.lookups.push(hostname);
          if (lookupError) return { data: null, error: lookupError };
          const store = stores.find((candidate) => candidate.hostname === hostname);
          return { data: store ? { empresa_id: store.empresaId } : null, error: null };
        },
      };
    },
    async rpc(name, params) {
      calls.rpc.push({ name, params });
      return rpcResult;
    },
  };
  return {
    calls,
    mocks: {
      "@supabase/supabase-js": { createClient: () => authClient },
      "../../../lib/supabaseServer": { supabaseServer },
      "../../../lib/storeRequest": require(STORE_REQUEST_FILE),
      "../../../lib/checkoutIdempotency": {
        parseIdempotencyKey: (value) => value,
        createCheckoutRequestFingerprint: () => "f".repeat(64),
      },
      "../../../lib/apiSecurity": {
        ...require(API_SECURITY_FILE),
        checkRateLimit: () => ({ ok: true, limit: 20, remaining: 19, retryAfterSeconds: 60 }),
        applyRateLimitHeaders() {},
      },
    },
  };
}

async function loadHandler(mocks) {
  const source = await readFile(PEDIDO_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "pedido.ts",
  }).outputText;
  const originalLoad = Module._load;
  const originalEnv = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
  });
  Module._load = function (id, parent, isMain) {
    if (id in mocks) return mocks[id];
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(PEDIDO_FILE.pathname);
    loaded.filename = PEDIDO_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, PEDIDO_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
    process.env = originalEnv;
  }
}

const CREATED = { data: [{ pedido_id: PEDIDO_ID, reutilizado: false }], error: null };

async function createOrder({ rpcResult = CREATED, request: requestOptions, ...dependencyOptions } = {}) {
  const { calls, mocks } = dependencies({ rpcResult, ...dependencyOptions });
  const handler = await loadHandler(mocks);
  const res = response();
  await handler(request(requestOptions), res);
  return { status: res.statusCode, body: res.payload, headers: res.headers, calls };
}

test("S1: each domain creates the order for its own store", async () => {
  for (const store of [STORE_A, STORE_B]) {
    const result = await createOrder({
      request: {
        host: store.hostname,
        headers: { origin: `https://${store.hostname}` },
        body: { empresa_id: store.empresaId, direccion_envio_id: DIRECCION_ID, items: ITEMS },
      },
    });
    assert.deepEqual(
      { status: result.status, body: result.body },
      { status: 200, body: { pedido_id: PEDIDO_ID, reutilizado: false } },
    );
    assert.deepEqual(result.calls.lookups, [store.hostname]);
    assert.equal(result.calls.rpc.length, 1);
    assert.equal(result.calls.rpc[0].params.p_empresa_id, store.empresaId);
  }
});

test("S1: the body empresa_id is optional and the store comes from the domain", async () => {
  for (const body of [
    { direccion_envio_id: DIRECCION_ID, items: ITEMS },
    { empresa_id: null, direccion_envio_id: DIRECCION_ID, items: ITEMS },
  ]) {
    const result = await createOrder({ request: { host: STORE_B.hostname, body } });
    assert.equal(result.status, 200, JSON.stringify(body));
    assert.equal(result.calls.rpc[0].params.p_empresa_id, STORE_B.empresaId);
  }
});

test("S1: another store's empresa_id is rejected before the order RPC", async () => {
  const result = await createOrder({
    request: {
      host: STORE_A.hostname,
      body: { empresa_id: STORE_B.empresaId, direccion_envio_id: DIRECCION_ID, items: ITEMS },
    },
  });
  assert.deepEqual(
    { status: result.status, body: result.body },
    { status: 400, body: { error: "empresa_no_coincide_con_dominio" } },
  );
  assert.deepEqual(result.calls.rpc, []);
});

test("S1: unknown and unavailable store domains are rejected before the order RPC", async () => {
  const unknown = await createOrder({ request: { host: "unknown.example" } });
  assert.deepEqual(
    { status: unknown.status, body: unknown.body },
    { status: 404, body: { error: "tienda_no_encontrada" } },
  );
  assert.deepEqual(unknown.calls.rpc, []);

  const unavailable = await createOrder({ lookupError: new Error("registry down") });
  assert.deepEqual(
    { status: unavailable.status, body: unavailable.body, cache: unavailable.headers["Cache-Control"] },
    { status: 503, body: { error: "tienda_no_disponible" }, cache: "no-store" },
  );
  assert.deepEqual(unavailable.calls.rpc, []);
});

test("S2: an origin from another store is untrusted", async () => {
  for (const origin of [`https://${STORE_B.hostname}`, "https://evil.example"]) {
    const result = await createOrder({ request: { host: STORE_A.hostname, headers: { origin } } });
    assert.deepEqual(
      { status: result.status, body: result.body },
      { status: 403, body: { error: "untrusted_origin" } },
      origin,
    );
    assert.deepEqual(result.calls.rpc, []);
  }
});

test("S2: a cookie session without origin is still rejected", async () => {
  const result = await createOrder({
    request: { host: STORE_A.hostname, headers: { authorization: undefined, cookie: "sb-access-token=token" } },
  });
  assert.deepEqual(
    { status: result.status, body: result.body },
    { status: 403, body: { error: "missing_origin" } },
  );
  assert.deepEqual(result.calls.rpc, []);
});

test("S1/S2 (Gate 4): availability conflicts answer 409 with their error code", async () => {
  for (const code of ["producto_no_disponible", "stock_insuficiente"]) {
    const result = await createOrder({ rpcResult: { data: null, error: { message: code } } });
    assert.deepEqual({ status: result.status, body: result.body }, { status: 409, body: { error: code } }, code);
  }
});

test("S6: existing checkout responses keep their status and body", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const [rpcResult, expected] of [
    [{ data: null, error: { message: "variante_sin_stock" } }, { status: 400, body: { error: "variante_sin_stock" } }],
    [{ data: null, error: { message: "producto_no_existe" } }, { status: 400, body: { error: "producto_no_existe" } }],
    [{ data: null, error: { message: "idempotency_key_reused" } }, { status: 409, body: { error: "idempotency_key_reused" } }],
    [{ data: null, error: { message: "unexpected database failure" } }, { status: 500, body: { error: "pedido_creation_failed" } }],
    [CREATED, { status: 200, body: { pedido_id: PEDIDO_ID, reutilizado: false } }],
  ]) {
    const result = await createOrder({ rpcResult });
    assert.deepEqual({ status: result.status, body: result.body }, expected, JSON.stringify(rpcResult));
  }
});
