import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import { generateCredentialKeyPair, sealCredential } from "../src/lib/mercadoPagoCredentials.ts";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const INTENTO_FILE = new URL("../src/pages/api/ecommerce/intento-pago.ts", import.meta.url);
const STORE_REQUEST_FILE = new URL("../src/lib/storeRequest.ts", import.meta.url).pathname;
const API_SECURITY_FILE = new URL("../src/lib/apiSecurity.ts", import.meta.url).pathname;
const STORE_PAYMENT_CREDENTIALS_FILE = new URL("../src/lib/storePaymentCredentials.ts", import.meta.url).pathname;
const MERCADOPAGO_PREFERENCE_FILE = new URL("../src/lib/mercadoPagoPreference.ts", import.meta.url).pathname;

const PLATFORM_URL = "https://raeyz.com";
const STORE_A = { hostname: "raeyz.com", empresaId: "11111111-1111-4111-8111-111111111111", mpUserId: 100001, token: "token-store-a" };
const STORE_B = { hostname: "ferreteria.example", empresaId: "22222222-2222-4222-8222-222222222222", mpUserId: 200002, token: "token-store-b" };
const LOCAL = { hostname: "localhost", empresaId: "33333333-3333-4333-8333-333333333333", mpUserId: 300003, token: "token-store-local" };
const PEDIDO_ID = "44444444-4444-4444-8444-444444444444";
const INTENTO_ID = "55555555-5555-4555-8555-555555555555";
const PREFERENCE = { id: "pref-1", init_point: "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-1" };

const CREDENTIAL_KEY_PAIR = generateCredentialKeyPair();

function sealedAccessToken(store) {
  return sealCredential({
    publicKeyPem: CREDENTIAL_KEY_PAIR.publicKeyPem,
    plaintext: store.token,
    empresaId: store.empresaId,
    field: "access_token",
    keyVersion: 1,
  });
}

function activeCredentialRow(store) {
  return {
    mp_user_id: store.mpUserId,
    live_mode: true,
    access_token_enc: sealedAccessToken(store),
    key_version: 1,
    estado: "activo",
  };
}

const DEFAULT_CREDENTIAL_ROWS = {
  [STORE_A.empresaId]: activeCredentialRow(STORE_A),
  [STORE_B.empresaId]: activeCredentialRow(STORE_B),
  [LOCAL.empresaId]: activeCredentialRow(LOCAL),
};

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

function freshIntento(overrides = {}) {
  return {
    id: INTENTO_ID,
    preference_id: null,
    preference_init_point: null,
    preference_creation_state: "not_started",
    preference_creation_started_at: null,
    preference_last_error: null,
    mp_user_id: null,
    ...overrides,
  };
}

function matchesFilter(row, filter) {
  if (filter.type === "eq") return row[filter.column] === filter.value;
  if (filter.type === "is") return filter.value === null ? row[filter.column] === null : row[filter.column] === filter.value;
  if (filter.type === "in") return filter.values.includes(row[filter.column]);
  return false;
}

function intentoQuery({ getState, setState, updatePayload, calls }) {
  const filters = [];
  const builder = {
    select() { return builder; },
    eq(column, value) { filters.push({ type: "eq", column, value }); return builder; },
    is(column, value) { filters.push({ type: "is", column, value }); return builder; },
    in(column, values) { filters.push({ type: "in", column, values }); return builder; },
    async maybeSingle() { return execute(); },
    async single() { return execute(); },
  };
  function execute() {
    const row = getState();
    if (!filters.every((filter) => matchesFilter(row, filter))) {
      return { data: null, error: null };
    }
    if (updatePayload) {
      const updated = { ...row, ...updatePayload };
      setState(updated);
      calls.intentoUpdates.push(updatePayload);
      return { data: { ...updated }, error: null };
    }
    return { data: { ...row }, error: null };
  }
  return builder;
}

function dependencies({
  orderStore,
  rpcRow,
  credentialRows = DEFAULT_CREDENTIAL_ROWS,
  initialIntento = freshIntento(),
} = {}) {
  const calls = { lookups: [], rpc: [], preferences: [], recoverCalls: [], reconcileCalls: [], pedidoFilters: [], credentialFilters: [], intentoUpdates: [] };
  let intentoState = { ...initialIntento };

  const query = (table) => {
    if (table === "intento_pago") {
      return {
        select() {
          return intentoQuery({ getState: () => intentoState, setState: (s) => { intentoState = s; }, updatePayload: null, calls });
        },
        update(values) {
          return intentoQuery({ getState: () => intentoState, setState: (s) => { intentoState = s; }, updatePayload: values, calls });
        },
      };
    }

    if (table === "empresa_mercadopago") {
      const filters = {};
      return {
        select() { return this; },
        eq(column, value) { filters[column] = value; return this; },
        async maybeSingle() {
          calls.credentialFilters.push({ ...filters });
          return { data: credentialRows[filters.empresa_id] ?? null, error: null };
        },
      };
    }

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
        return { data: null, error: null };
      },
      async single() {
        if (table === "usuario") return { data: { id: "usuario-1" }, error: null };
        if (table === "pedido") {
          return { data: { id: PEDIDO_ID, total: "1500.00", expira_en: "2099-01-01T00:00:00.000Z" }, error: null };
        }
        return { data: null, error: null };
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
    getIntentoState: () => intentoState,
    mocks: {
      "@supabase/supabase-js": { createClient: () => client },
      "../../../lib/supabaseServer": { supabaseServer },
      "../../../lib/storeRequest": require(STORE_REQUEST_FILE),
      "../../../lib/storePaymentCredentials": require(STORE_PAYMENT_CREDENTIALS_FILE),
      "../../../lib/apiSecurity": {
        ...require(API_SECURITY_FILE),
        checkRateLimit: () => ({ ok: true, limit: 10, remaining: 9, retryAfterSeconds: 60 }),
        applyRateLimitHeaders() {},
      },
      "../../../lib/mercadoPagoPreference": {
        MercadoPagoBridgeError: class MercadoPagoBridgeError extends Error {},
        assertPreferenceMatchesPersisted() {},
        getPreferenceResolutionMode: require(MERCADOPAGO_PREFERENCE_FILE).getPreferenceResolutionMode,
        isManualPreferenceRetryAllowed: require(MERCADOPAGO_PREFERENCE_FILE).isManualPreferenceRetryAllowed,
        async createMercadoPagoPreference(params) {
          calls.preferences.push({ accessToken: params.accessToken, notificationUrl: params.notificationUrl, backUrls: params.backUrls });
          return PREFERENCE;
        },
        async reconcileMercadoPagoPreference(params) {
          calls.reconcileCalls.push({ accessToken: params.accessToken });
          return PREFERENCE;
        },
        async recoverMercadoPagoPreference(params) {
          calls.recoverCalls.push({ accessToken: params.accessToken, preferenceId: params.preferenceId });
          return PREFERENCE;
        },
      },
    },
  };
}

async function withHandler(mocks, { deleteEnvKeys = [] } = {}, run) {
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
    APP_BASE_URL: PLATFORM_URL,
    MP_CREDENTIALS_PRIVATE_KEY_V1: CREDENTIAL_KEY_PAIR.privateKeyPem,
  });
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  for (const key of deleteEnvKeys) delete process.env[key];
  Module._load = function (id, parent, isMain) {
    if (id in mocks) return mocks[id];
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(INTENTO_FILE.pathname);
    loaded.filename = INTENTO_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, INTENTO_FILE.pathname);
    return await run(loaded.exports.default);
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

async function startPayment({
  requestOptions = {},
  orderStore = STORE_A,
  rpcRow = CREATED_ROW,
  credentialRows,
  initialIntento,
  deleteEnvKeys,
} = {}) {
  const { calls, mocks, getIntentoState } = dependencies({ orderStore, rpcRow, credentialRows, initialIntento });
  const res = response();
  await withHandler(mocks, { deleteEnvKeys }, (handler) => handler(request(requestOptions), res));
  return { status: res.statusCode, body: res.payload, headers: res.headers, calls, getIntentoState };
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
      accessToken: store.token,
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

test("P2/P3: two stores each create, recover and reconcile with their own token", async (t) => {
  for (const store of [STORE_A, STORE_B]) {
    await t.test(`${store.hostname} create`, async () => {
      const result = await startPayment({ requestOptions: { host: store.hostname }, orderStore: store });
      assert.equal(result.status, 201);
      assert.deepEqual(result.calls.preferences.map((call) => call.accessToken), [store.token]);
      assert.deepEqual(result.calls.recoverCalls, []);
      assert.deepEqual(result.calls.reconcileCalls, []);
      const stampUpdate = result.calls.intentoUpdates.find((update) => update.preference_creation_state === "ready");
      assert.equal(stampUpdate.mp_user_id, store.mpUserId);
    });

    await t.test(`${store.hostname} recover`, async () => {
      const result = await startPayment({
        requestOptions: { host: store.hostname },
        orderStore: store,
        initialIntento: freshIntento({
          preference_id: PREFERENCE.id,
          preference_init_point: null,
          preference_creation_state: "creating",
        }),
      });
      assert.equal(result.status, 201);
      assert.deepEqual(result.calls.recoverCalls, [{ accessToken: store.token, preferenceId: PREFERENCE.id }]);
      assert.deepEqual(result.calls.preferences, []);
      assert.deepEqual(result.calls.reconcileCalls, []);
      const stampUpdate = result.calls.intentoUpdates.find((update) => update.preference_creation_state === "ready");
      assert.equal(stampUpdate.mp_user_id, store.mpUserId);
    });

    await t.test(`${store.hostname} reconcile`, async () => {
      const result = await startPayment({
        requestOptions: { host: store.hostname },
        orderStore: store,
        initialIntento: freshIntento({ preference_creation_state: "ambiguous" }),
      });
      assert.equal(result.status, 201);
      assert.deepEqual(result.calls.reconcileCalls, [{ accessToken: store.token }]);
      assert.deepEqual(result.calls.preferences, []);
      assert.deepEqual(result.calls.recoverCalls, []);
      const stampUpdate = result.calls.intentoUpdates.find((update) => update.preference_creation_state === "ready");
      assert.equal(stampUpdate.mp_user_id, store.mpUserId);
    });
  }
});

test("P1/P2: a store without credentials answers 409 before the RPC and before Mercado Pago", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_B.hostname },
    orderStore: STORE_B,
    credentialRows: { [STORE_A.empresaId]: DEFAULT_CREDENTIAL_ROWS[STORE_A.empresaId] },
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 409, body: { error: "pagos_no_configurados" } });
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(result.calls.rpc, []);
  assert.deepEqual(result.calls.preferences, []);
});

test("P1/P2: an inactive store answers 409 before the RPC", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_B.hostname },
    orderStore: STORE_B,
    credentialRows: { [STORE_B.empresaId]: { ...DEFAULT_CREDENTIAL_ROWS[STORE_B.empresaId], estado: "inactivo" } },
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 409, body: { error: "pagos_no_configurados" } });
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(result.calls.rpc, []);
});

test("P1/P2: a missing private key answers 503 with Cache-Control no-store and no RPC", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_B.hostname },
    orderStore: STORE_B,
    deleteEnvKeys: ["MP_CREDENTIALS_PRIVATE_KEY_V1"],
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 503, body: { error: "pagos_no_disponibles" } });
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(result.calls.rpc, []);
  assert.deepEqual(result.calls.preferences, []);
});

test("P3: an attempt already stamped for a different store conflicts without calling Mercado Pago", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_A.hostname },
    orderStore: STORE_A,
    initialIntento: freshIntento({
      preference_id: PREFERENCE.id,
      preference_init_point: PREFERENCE.init_point,
      preference_creation_state: "ready",
      mp_user_id: STORE_B.mpUserId,
    }),
  });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 409, body: { error: "mercadopago_preference_conflict" } });
  assert.deepEqual(result.calls.preferences, []);
  assert.deepEqual(result.calls.recoverCalls, []);
  assert.deepEqual(result.calls.reconcileCalls, []);
});

test("P3: recover and reconcile also refuse an attempt stamped by another account", async (t) => {
  for (const [mode, overrides] of [
    ["recover", { preference_id: PREFERENCE.id, preference_init_point: null, preference_creation_state: "creating" }],
    ["reconcile", { preference_creation_state: "ambiguous" }],
  ]) {
    await t.test(mode, async () => {
      const result = await startPayment({
        requestOptions: { host: STORE_A.hostname },
        orderStore: STORE_A,
        initialIntento: freshIntento({ ...overrides, mp_user_id: STORE_B.mpUserId }),
      });
      assert.deepEqual({ status: result.status, body: result.body }, { status: 409, body: { error: "mercadopago_preference_conflict" } });
      assert.deepEqual(result.calls.preferences, []);
      assert.deepEqual(result.calls.recoverCalls, []);
      assert.deepEqual(result.calls.reconcileCalls, []);
      assert.equal(result.calls.intentoUpdates.some((update) => "mp_user_id" in update), false);
    });
  }
});

test("P3: a null mp_user_id is accepted and gets stamped on reuse", async () => {
  const result = await startPayment({
    requestOptions: { host: STORE_A.hostname },
    orderStore: STORE_A,
    initialIntento: freshIntento({
      preference_id: PREFERENCE.id,
      preference_init_point: PREFERENCE.init_point,
      preference_creation_state: "ready",
      mp_user_id: null,
    }),
  });
  assert.equal(result.status, 201);
  assert.deepEqual(result.calls.preferences, []);
  assert.deepEqual(result.calls.intentoUpdates.filter((update) => "mp_user_id" in update), [{ mp_user_id: STORE_A.mpUserId }]);
});

test("P4: notification_url stays on the shared platform webhook route", async () => {
  const result = await startPayment({ requestOptions: { host: STORE_A.hostname }, orderStore: STORE_A });
  assert.equal(result.calls.preferences[0].notificationUrl, `${PLATFORM_URL}/api/webhooks/mercadopago`);
});
