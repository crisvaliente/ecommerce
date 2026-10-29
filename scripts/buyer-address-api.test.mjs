import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const DIRECCION_FILE = new URL("../src/pages/api/ecommerce/mi-cuenta/direccion.ts", import.meta.url);
const STORE_REQUEST_FILE = new URL("../src/lib/storeRequest.ts", import.meta.url).pathname;
const API_SECURITY_FILE = new URL("../src/lib/apiSecurity.ts", import.meta.url).pathname;

const STORE_A = { hostname: "raeyz.com", empresaId: "11111111-1111-4111-8111-111111111111" };
const STORE_B = { hostname: "ferreteria.example", empresaId: "22222222-2222-4222-8222-222222222222" };
const ADDRESS = {
  id: "33333333-3333-4333-8333-333333333333",
  direccion: "Uruguay 123",
  ciudad: "Salto",
  pais: "Uruguay",
  codigo_postal: "50000",
  tipo_direccion: "hogar",
  fecha_creacion: "2026-10-29T00:00:00.000Z",
};
const PAYLOAD = {
  direccion: ADDRESS.direccion,
  ciudad: ADDRESS.ciudad,
  pais: ADDRESS.pais,
  codigo_postal: ADDRESS.codigo_postal,
  tipo_direccion: ADDRESS.tipo_direccion,
};

function request({ method = "PUT", host = STORE_A.hostname, headers = {} } = {}) {
  return {
    method,
    headers: { host, authorization: "Bearer buyer-token", ...headers },
    rawHeaders: ["Host", host],
    body: method === "PUT" ? PAYLOAD : undefined,
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

function dependencies({ existing = null }) {
  const calls = { lookups: [], writes: [] };
  const query = (table) => {
    const chain = {
      select() { return chain; },
      eq() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      insert(values) { calls.writes.push({ table, op: "insert", values }); return chain; },
      update(values) { calls.writes.push({ table, op: "update", values }); return chain; },
      async maybeSingle() {
        if (table === "usuario") return { data: { id: "usuario-1" }, error: null };
        return { data: existing, error: null };
      },
      async single() { return { data: ADDRESS, error: null }; },
    };
    return chain;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    from: query,
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
          const store = [STORE_A, STORE_B].find((candidate) => candidate.hostname === hostname);
          return { data: store ? { empresa_id: store.empresaId } : null, error: null };
        },
      };
    },
  };
  return {
    calls,
    mocks: {
      "@supabase/supabase-js": { createClient: () => client },
      "../../../../lib/supabaseServer": { supabaseServer },
      "../../../../lib/storeRequest": require(STORE_REQUEST_FILE),
      "../../../../lib/apiSecurity": {
        ...require(API_SECURITY_FILE),
        checkRateLimit: () => ({ ok: true, limit: 20, remaining: 19, retryAfterSeconds: 60 }),
        applyRateLimitHeaders() {},
      },
    },
  };
}

async function loadHandler(mocks) {
  const source = await readFile(DIRECCION_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "direccion.ts",
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
    const loaded = new Module(DIRECCION_FILE.pathname);
    loaded.filename = DIRECCION_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, DIRECCION_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
    process.env = originalEnv;
  }
}

async function call(requestOptions, dependencyOptions = {}) {
  const { calls, mocks } = dependencies(dependencyOptions);
  const handler = await loadHandler(mocks);
  const res = response();
  await handler(request(requestOptions), res);
  return { status: res.statusCode, body: res.payload, calls };
}

test("S2: each store saves the address from its own origin", async () => {
  for (const store of [STORE_A, STORE_B]) {
    const result = await call({ host: store.hostname, headers: { origin: `https://${store.hostname}` } });
    assert.deepEqual({ status: result.status, body: result.body }, { status: 200, body: { direccion: ADDRESS } });
    assert.deepEqual(result.calls.lookups, [store.hostname]);
    assert.deepEqual(result.calls.writes.map(({ table, op }) => ({ table, op })), [{ table: "direccion_usuario", op: "insert" }]);
  }
});

test("S2: another store's origin cannot save the address", async () => {
  const result = await call({ host: STORE_A.hostname, headers: { origin: `https://${STORE_B.hostname}` } });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 403, body: { error: "untrusted_origin" } });
  assert.deepEqual(result.calls.writes, []);
});

test("S2: an unknown domain cannot save the address", async () => {
  const result = await call({ host: "unknown.example", headers: { origin: "https://unknown.example" } });
  assert.deepEqual({ status: result.status, body: result.body }, { status: 404, body: { error: "tienda_no_encontrada" } });
  assert.deepEqual(result.calls.writes, []);
});

test("S6: reading the account address and bearer writes without origin are unchanged", async () => {
  const read = await call({ method: "GET", host: "unknown.example" }, { existing: ADDRESS });
  assert.deepEqual({ status: read.status, body: read.body }, { status: 200, body: { direccion: ADDRESS } });
  assert.deepEqual(read.calls.writes, []);

  const update = await call({ host: STORE_A.hostname }, { existing: { id: ADDRESS.id } });
  assert.deepEqual({ status: update.status, body: update.body }, { status: 200, body: { direccion: ADDRESS } });
  assert.deepEqual(update.calls.writes.map(({ table, op }) => ({ table, op })), [{ table: "direccion_usuario", op: "update" }]);
});
