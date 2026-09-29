import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const ROUTE_FILE = new URL("../src/pages/api/panel/productos/[id]/modo-variantes.ts", import.meta.url);
const PRODUCTO_ID = "5f2b7c1e-8d4a-4c3b-9e6f-1a2b3c4d5e6f";
const SWITCHED = { ok: true, codigo_resultado: "modo_variantes_activado", variante_id: "variante-1", stock_migrado: 7 };

function request({ method = "POST", query = { id: PRODUCTO_ID }, headers = {} } = {}) {
  return { method, query, headers, socket: { remoteAddress: "127.0.0.1" } };
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

async function loadHandler(dependencies) {
  const source = await readFile(ROUTE_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "modo-variantes.ts",
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function (id, parent, isMain) {
    if (id === "../../../../../lib/apiSecurity") return dependencies.security;
    if (id === "../../../../../lib/panelAuthorization") return dependencies.authorization;
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(ROUTE_FILE.pathname);
    loaded.filename = ROUTE_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, ROUTE_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
  }
}

function fixture({
  authorization = async () => ({ ok: true, principal: { empresaId: "empresa-a" } }),
  rateLimit = { ok: true, limit: 30 },
  origin = { ok: true, origin: null },
  rpcResult = { data: [SWITCHED], error: null },
  estadoResult = { data: { estado: "draft" }, error: null },
  serviceThrows = false,
} = {}) {
  const calls = { authorization: [], origin: [], rateLimit: [], rpc: [], select: [] };
  let serviceConstructions = 0;
  const service = {
    async rpc(name, params) { calls.rpc.push({ name, params }); return rpcResult; },
    from(table) {
      const query = { table, filters: [] };
      calls.select.push(query);
      return {
        select(columns) { query.columns = columns; return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        async single() { return estadoResult; },
      };
    },
  };
  return {
    calls,
    get serviceConstructions() { return serviceConstructions; },
    dependencies: {
      security: {
        checkRateLimit(req, options) { calls.rateLimit.push(options); return rateLimit; },
        applyRateLimitHeaders() {},
        hasBearerAuthorization(req) { return typeof req.headers.authorization === "string"; },
        hasSessionAccessCookie(req) { return typeof req.headers.cookie === "string"; },
        validateTrustedOrigin(req, options) { calls.origin.push(options); return origin; },
      },
      authorization: {
        authorizePanelRequest: async (...args) => { calls.authorization.push(args.slice(1)); return authorization(...args); },
        createPanelServiceClient() {
          serviceConstructions += 1;
          if (serviceThrows) throw new Error("service unavailable");
          return service;
        },
      },
    },
  };
}

async function invoke(requestOptions, fixtureOptions) {
  const state = fixture(fixtureOptions);
  const handler = await loadHandler(state.dependencies);
  const res = response();
  await handler(request(requestOptions), res);
  return { ...state, res };
}

test("switches only a product of the canonical tenant and returns its resulting state", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, calls } = await invoke({}, { authorization: async () => ({ ok: true, principal: { empresaId } }) });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.payload, { codigo_resultado: "modo_variantes_activado", stock_migrado: 7, estado: "draft" });
      assert.deepEqual(calls.authorization, [["catalog.operate"]]);
      assert.deepEqual(calls.rateLimit, [{ key: "api:panel:productos:write", limit: 30, windowMs: 60_000 }]);
      assert.deepEqual(calls.rpc, [{ name: "pasar_producto_a_variantes", params: { p_producto_id: PRODUCTO_ID, p_empresa_id: empresaId } }]);
      assert.deepEqual(calls.select, [{ table: "producto", columns: "estado", filters: [["id", PRODUCTO_ID], ["empresa_id", empresaId]] }]);
      assert.equal(res.headers["Cache-Control"], "no-store");
    });
  }
});

test("an already switched product is a successful no-op", async () => {
  const { res } = await invoke({}, {
    rpcResult: { data: [{ ok: true, codigo_resultado: "ya_usa_variantes", variante_id: null, stock_migrado: 0 }], error: null },
    estadoResult: { data: { estado: "published" }, error: null },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { codigo_resultado: "ya_usa_variantes", stock_migrado: 0, estado: "published" });
});

test("maps RPC outcomes", async (t) => {
  const cases = [
    ["not in tenant", { data: [{ ok: false, codigo_resultado: "producto_no_encontrado", variante_id: null, stock_migrado: 0 }], error: null }, 404, "producto_no_encontrado"],
    ["pending order", { data: null, error: { code: "55006", message: "producto_en_pedido_activo" } }, 409, "producto_en_pedido_activo"],
    ["database failure", { data: null, error: { code: "XX000" } }, 500, "internal_error"],
    ["unexpected result", { data: [], error: null }, 500, "internal_error"],
  ];
  for (const [name, rpcResult, status, error] of cases) {
    await t.test(name, async () => {
      const { res, calls } = await invoke({}, { rpcResult });
      assert.equal(res.statusCode, status);
      assert.deepEqual(res.payload, { error });
      assert.equal(calls.select.length, 0);
    });
  }
});

test("a failed state lookup after the switch is reported as internal", async () => {
  const { res } = await invoke({}, { estadoResult: { data: null, error: { code: "XX000" } } });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, { error: "internal_error" });
});

test("rejects invalid requests before authorization", async (t) => {
  const cases = [
    ["method", { method: "GET" }, 405, "Method not allowed"],
    ["legacy tenant", { query: { id: PRODUCTO_ID, empresa_id: "empresa-b" } }, 400, "legacy_tenant_input"],
    ["missing id", { query: {} }, 400, "invalid_request"],
    ["invalid id", { query: { id: "producto-a" } }, 400, "invalid_request"],
  ];
  for (const [name, requestOptions, status, error] of cases) {
    await t.test(name, async () => {
      const result = await invoke(requestOptions);
      assert.equal(result.res.statusCode, status);
      assert.deepEqual(result.res.payload, { error });
      assert.equal(result.calls.authorization.length, 0);
      assert.equal(result.serviceConstructions, 0);
    });
  }
  const methodResult = await invoke({ method: "GET" });
  assert.equal(methodResult.res.headers.Allow, "POST");

  const limited = await invoke({}, { rateLimit: { ok: false, limit: 30 } });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.calls.authorization.length, 0);
});

test("requires a trusted origin for cookie sessions and authorization before the service", async () => {
  const cookie = await invoke(
    { headers: { cookie: "sb-access-token=a" } },
    { origin: { ok: false, reason: "untrusted_origin", origin: "https://evil.example" } },
  );
  assert.deepEqual(cookie.calls.origin, [{ allowWithoutOrigin: false }]);
  assert.equal(cookie.res.statusCode, 403);
  assert.equal(cookie.calls.authorization.length, 0);

  const denied = await invoke(
    { headers: { authorization: "Bearer a" } },
    { authorization: async () => ({ ok: false, status: 403, error: "forbidden" }) },
  );
  assert.deepEqual(denied.calls.origin, [{ allowWithoutOrigin: true }]);
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.serviceConstructions, 0);

  const thrown = await invoke({}, { serviceThrows: true });
  assert.equal(thrown.res.statusCode, 500);
  assert.deepEqual(thrown.res.payload, { error: "internal_error" });
});
