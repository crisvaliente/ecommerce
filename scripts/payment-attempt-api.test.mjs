import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const INTENTO_FILE = new URL("../src/pages/api/ecommerce/intento-pago.ts", import.meta.url);
const STORE_REQUEST_FILE = new URL("../src/lib/storeRequest.ts", import.meta.url).pathname;
const API_SECURITY_FILE = new URL("../src/lib/apiSecurity.ts", import.meta.url).pathname;

const PLATFORM_URL = "https://raeyz.com";
const STORE_A = { hostname: "raeyz.com", empresaId: "11111111-1111-4111-8111-111111111111" };
const STORE_B = { hostname: "ferreteria.example", empresaId: "22222222-2222-4222-8222-222222222222" };
const LOCAL = { hostname: "localhost", empresaId: "33333333-3333-4333-8333-333333333333" };
const PEDIDO_ID = "44444444-4444-4444-8444-444444444444";
const INTENTO_ID = "55555555-5555-4555-8555-555555555555";
const PREFERENCE = { id: "pref-1", init_point: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-1" };

function request({ host = STORE_A.hostname, headers = {}, pedidoId = PEDIDO_ID } = {}) {
  return {
    method: "POST",
    headers: { host, authorization: "Bearer buyer-token", ...headers },
    rawHeaders: ["Host", host],
    body: { pedido_id: pedidoId },
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

function dependencies({ orderStore, rpcRow }) {
  const calls = { lookups: [], rpc: [], preferences: [], pedidoFilters: [] };
  const intentoRow = {
    id: INTENTO_ID,
    preference_id: PREFERENCE.id,
    preference_init_point: PREFERENCE.init_point,
    preference_creation_state: "ready",
    preference_creation_started_at: null,
    preference_last_error: null,
  };
  const query = (table) => {
    const filters = {};
    const chain = {
      select() { return chain; },
      update() { return chain; },
      in() { return chain; },
      is() { return chain; },
      eq(column, value) { filters[column] = value; return chain; },
      async maybeSingle() {
        if (table === "pedido") {
          calls.pedidoFilters.push({ ...filters });
          const visible = filters.id === PEDIDO_ID && filters.empresa_id === orderStore.empresaId;
          return { data: visible ? { id: PEDIDO_ID } : null, error: null };
        }
        return { data: intentoRow, error: null };
      },
      async single() {
        if (table === "usuario") return { data: { id: "usuario-1" }, error: null };
        if (table === "pedido") {
          return { data: { id: PEDIDO_ID, total: "1500.00", expira_en: "2099-01-01T00:00:00.000Z" }, error: null };
        }
        return { data: { ...intentoRow, preference_id: null, preference_init_point: null, preference_creation_state: "not_started" }, error: null };
      },
    };
    return chain;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    from: query,
    async rpc(name, params) {
      calls.rpc.push({ name, params });
      return { data: [rpcRow], error: null };
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
          const store = [STORE_A, STORE_B, LOCAL].find((candidate) => candidate.hostname === hostname);
          return { data: store ? { empresa_id: store.empresaId } : null, error: null };
        },
      };
    },
  };
  return {
    calls,
    mocks: {
      "@supabase/supabase-js": { createClient: () => client },
      "../../../lib/supabaseServer": { supabaseServer },
      "../../../lib/storeRequest": require(STORE_REQUEST_FILE),
      "../../../lib/apiSecurity": {
        ...require(API_SECURITY_FILE),
        checkRateLimit: () => ({ ok: true, limit: 10, remaining: 9, retryAfterSeconds: 60 }),
        applyRateLimitHeaders() {},
      },
      "../../../lib/mercadoPagoPreference": {
        MercadoPagoBridgeError: class MercadoPagoBridgeError extends Error {},
        assertPreferenceMatchesPersisted() {},
        getPreferenceResolutionMode: () => "claim",
        isManualPreferenceRetryAllowed: () => false,
        async createMercadoPagoPreference(params) {
          calls.preferences.push({ notificationUrl: params.notificationUrl, backUrls: params.backUrls });
          return PREFERENCE;
        },
        async reconcileMercadoPagoPreference() { throw new Error("unexpected reconcile"); },
        async recoverMercadoPagoPreference() { throw new Error("unexpected recover"); },
      },
    },
  };
}

async function loadHandler(mocks) {
  const source = await readFile(INTENTO_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "intento-pago.ts",
  }).outputText;
  const originalLoad = Module._load;
  const originalEnv = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
    MERCADOPAGO_ACCESS_TOKEN: "mp-test-token",
    APP_BASE_URL: PLATFORM_URL,
  });
  Module._load = function (id, parent, isMain) {
    if (id in mocks) return mocks[id];
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(INTENTO_FILE.pathname);
    loaded.filename = INTENTO_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, INTENTO_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
    process.env = originalEnv;
  }
}

const CREATED_ROW = {
  ok: true,
  codigo_resultado: "creado",
  intento_pago_id: INTENTO_ID,
  pedido_id: PEDIDO_ID,
  estado_intento: "iniciado",
};

async function startPayment({ requestOptions = {}, orderStore = STORE_A, rpcRow = CREATED_ROW } = {}) {
  const { calls, mocks } = dependencies({ orderStore, rpcRow });
  const handler = await loadHandler(mocks);
  const res = response();
  await handler(request(requestOptions), res);
  return { status: res.statusCode, body: res.payload, calls };
}

function resultUrls(origin) {
  return Object.fromEntries(["success", "failure", "pending"].map((status) => [
    status,
    `${origin}/checkout/resultado?pedido_id=${PEDIDO_ID}&status=${status}`,
  ]));
}

const CREATED_BODY = {
  intento_pago: {
    id: INTENTO_ID,
    pedido_id: PEDIDO_ID,
    estado: "iniciado",
    preference_id: PREFERENCE.id,
    init_point: PREFERENCE.init_point,
  },
};

test("S4: the buyer returns to the store's own domain; the webhook stays on the platform", async () => {
  for (const [store, origin] of [
    [STORE_A, "https://raeyz.com"],
    [STORE_B, "https://ferreteria.example"],
    [LOCAL, "http://localhost:3000"],
  ]) {
    const result = await startPayment({
      requestOptions: { host: store.hostname, headers: { origin } },
      orderStore: store,
    });
    assert.deepEqual({ status: result.status, body: result.body }, { status: 201, body: CREATED_BODY }, store.hostname);
    assert.deepEqual(result.calls.preferences, [{
      notificationUrl: `${PLATFORM_URL}/api/webhooks/mercadopago`,
      backUrls: resultUrls(origin),
    }]);
  }
});

test("S4: without an origin the return URLs use https on the store hostname", async () => {
  const result = await startPayment({ requestOptions: { host: STORE_B.hostname }, orderStore: STORE_B });
  assert.equal(result.status, 201);
  assert.deepEqual(result.calls.preferences[0].backUrls, resultUrls("https://ferreteria.example"));
});

test("S3: an order of another store is not found and nothing is created", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_B.hostname, headers: { origin: "https://ferreteria.example" } },
    orderStore: STORE_A,
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 404, body: { error: "pedido_no_encontrado" } });
  assert.deepEqual(result.calls.pedidoFilters, [{ id: PEDIDO_ID, empresa_id: STORE_B.empresaId }]);
  assert.deepEqual(result.calls.rpc, []);
  assert.deepEqual(result.calls.preferences, []);
});

test("S3: unknown domains are rejected before any payment work", async () => {
  const result = await startPayment({ requestOptions: { host: "unknown.example" } });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 404, body: { error: "tienda_no_encontrada" } });
  assert.deepEqual(result.calls.rpc, []);
  assert.deepEqual(result.calls.preferences, []);
});

test("S2: an origin from another store is untrusted", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_A.hostname, headers: { origin: "https://ferreteria.example" } },
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 403, body: { error: "untrusted_origin" } });
  assert.deepEqual(result.calls.rpc, []);
});

test("S6: existing payment responses are unchanged on a registered domain", async () => {
  const invalid = await startPayment({ requestOptions: { pedidoId: "not-a-uuid" } });
  assert.deepEqual({ status: invalid.status, body: invalid.body }, { status: 400, body: { error: "pedido_id_invalido" } });

  const expired = await startPayment({
    rpcRow: { ok: false, codigo_resultado: "pedido_expirado", intento_pago_id: null, pedido_id: null, estado_intento: null },
  });
  assert.deepEqual({ status: expired.status, body: expired.body }, { status: 409, body: { error: "pedido_expirado" } });
});
