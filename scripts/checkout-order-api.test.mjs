import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const PEDIDO_FILE = new URL("../src/pages/api/ecommerce/pedido.ts", import.meta.url);

const EMPRESA_ID = "22222222-2222-4222-8222-222222222222";
const DIRECCION_ID = "33333333-3333-4333-8333-333333333333";
const PEDIDO_ID = "44444444-4444-4444-8444-444444444444";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

function request() {
  return {
    method: "POST",
    headers: { authorization: "Bearer buyer-token", "idempotency-key": IDEMPOTENCY_KEY },
    body: {
      empresa_id: EMPRESA_ID,
      direccion_envio_id: DIRECCION_ID,
      items: [{ producto_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cantidad: 1 }],
    },
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

function dependencies(rpcResult) {
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
  return {
    "@supabase/supabase-js": { createClient: () => authClient },
    "../../../lib/supabaseServer": { supabaseServer: { rpc: async () => rpcResult } },
    "../../../lib/checkoutIdempotency": {
      parseIdempotencyKey: (value) => value,
      createCheckoutRequestFingerprint: () => "f".repeat(64),
    },
    "../../../lib/apiSecurity": {
      checkRateLimit: () => ({ ok: true, limit: 20, remaining: 19, retryAfterSeconds: 60 }),
      applyRateLimitHeaders() {},
      hasBearerAuthorization: () => true,
      hasSessionAccessCookie: () => false,
      validateTrustedOrigin: () => ({ ok: true, origin: null }),
      isOriginValidationFailure: (result) => !result.ok,
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

async function createOrder(rpcResult) {
  const handler = await loadHandler(dependencies(rpcResult));
  const res = response();
  await handler(request(), res);
  return { status: res.statusCode, body: res.payload };
}

test("S1/S2: availability conflicts answer 409 with their error code", async () => {
  for (const code of ["producto_no_disponible", "stock_insuficiente"]) {
    assert.deepEqual(
      await createOrder({ data: null, error: { message: code } }),
      { status: 409, body: { error: code } },
      code,
    );
  }
});

test("S4: existing checkout responses keep their status and body", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const [rpcResult, expected] of [
    [{ data: null, error: { message: "variante_sin_stock" } }, { status: 400, body: { error: "variante_sin_stock" } }],
    [{ data: null, error: { message: "producto_no_existe" } }, { status: 400, body: { error: "producto_no_existe" } }],
    [{ data: null, error: { message: "idempotency_key_reused" } }, { status: 409, body: { error: "idempotency_key_reused" } }],
    [{ data: null, error: { message: "unexpected database failure" } }, { status: 500, body: { error: "pedido_creation_failed" } }],
    [
      { data: [{ pedido_id: PEDIDO_ID, reutilizado: false }], error: null },
      { status: 200, body: { pedido_id: PEDIDO_ID, reutilizado: false } },
    ],
  ]) {
    assert.deepEqual(await createOrder(rpcResult), expected, JSON.stringify(rpcResult));
  }
});
