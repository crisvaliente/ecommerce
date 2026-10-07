import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const PRODUCTOS_FILE = new URL("../src/pages/api/panel/productos.ts", import.meta.url);

const PRODUCTO_ID = "5f2b7c1e-8d4a-4c3b-9e6f-1a2b3c4d5e6f";

function request({ method = "GET", query = {}, headers = {} } = {}) {
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
    end() { this.ended = true; return this; },
  };
}

async function loadHandler(dependencies) {
  const source = await readFile(PRODUCTOS_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "productos.ts",
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function (id, parent, isMain) {
    if (id === "../../../lib/apiSecurity") return dependencies.security;
    if (id === "../../../lib/panelAuthorization") return dependencies.authorization;
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(PRODUCTOS_FILE.pathname);
    loaded.filename = PRODUCTOS_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, PRODUCTOS_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
  }
}

function fixture({
  authorization = async () => ({ ok: true, principal: { empresaId: "empresa-a" } }),
  rateLimit = { ok: true, limit: 60, remaining: 59, retryAfterSeconds: 60 },
  productos = [{ id: "producto-a", nombre: "A", descripcion: null, precio: 12, estado: "published", stock: 3 }],
  resumen = [{ producto_id: "producto-a", stock_total: 8, usa_variantes: true }],
  productosError = null,
  resumenError = null,
  deleteResult = { data: { id: PRODUCTO_ID }, error: null },
  origin = { ok: true, origin: null },
  serviceThrows = false,
} = {}) {
  const authorizationCalls = [];
  const originCalls = [];
  const serviceCalls = [];
  let serviceConstructions = 0;
  const service = {
    from(table) {
      serviceCalls.push({ step: "from", table });
      return {
        select(columns) { serviceCalls.push({ step: "select", table, columns }); return this; },
        delete() { serviceCalls.push({ step: "delete", table }); return this; },
        eq(column, value) { serviceCalls.push({ step: "eq", table, column, value }); return this; },
        order(column, options) { serviceCalls.push({ step: "order", table, column, options }); return this; },
        async maybeSingle() { serviceCalls.push({ step: "maybeSingle", table }); return deleteResult; },
        async returns() {
          return table === "producto"
            ? { data: productos, error: productosError }
            : { data: resumen, error: resumenError };
        },
      };
    },
  };
  return {
    authorizationCalls,
    originCalls,
    serviceCalls,
    get serviceConstructions() { return serviceConstructions; },
    dependencies: {
      security: {
        checkRateLimit() { return rateLimit; },
        applyRateLimitHeaders(res, result) { res.setHeader("X-RateLimit-Limit", String(result.limit)); },
        hasBearerAuthorization(req) { return typeof req.headers.authorization === "string"; },
        hasSessionAccessCookie(req) { return typeof req.headers.cookie === "string"; },
        validateTrustedOrigin(req, options) {
          originCalls.push(options);
          return origin;
        },
      },
      authorization: {
        authorizePanelRequest: async (...args) => {
          authorizationCalls.push(args);
          return authorization(...args);
        },
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

test("uses only the canonical authorized tenant for both privileged queries", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, authorizationCalls, serviceCalls } = await invoke({}, {
        authorization: async () => ({ ok: true, principal: { empresaId } }),
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(authorizationCalls.map((call) => call.slice(1)), [["catalog.operate"]]);
      assert.deepEqual(
        serviceCalls.filter((call) => call.step === "eq").map(({ table, column, value }) => ({ table, column, value })),
        [
          { table: "producto", column: "empresa_id", value: empresaId },
          { table: "producto_stock_resumen", column: "empresa_id", value: empresaId },
        ],
      );
    });
  }
});

test("rejects every present legacy tenant query value before authorization or service", async (t) => {
  for (const empresa_id of ["empresa-a", "foreign", "", ["empresa-a", "foreign"], null, undefined]) {
    await t.test(String(empresa_id), async () => {
      const { res, authorizationCalls, serviceConstructions } = await invoke({ query: { empresa_id } });
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.payload, { error: "legacy_tenant_input" });
      assert.equal(authorizationCalls.length, 0);
      assert.equal(serviceConstructions, 0);
    });
  }
});

test("retains method and rate-limit precedence over legacy input", async () => {
  const method = await invoke({ method: "POST", query: { empresa_id: "empresa-a" } });
  assert.equal(method.res.statusCode, 405);
  assert.equal(method.res.headers.Allow, "GET, DELETE");
  assert.deepEqual(method.res.payload, { error: "Method not allowed" });
  assert.equal(method.authorizationCalls.length, 0);

  const limited = await invoke({ query: { empresa_id: "empresa-a" } }, { rateLimit: { ok: false, limit: 60 } });
  assert.equal(limited.res.statusCode, 429);
  assert.deepEqual(limited.res.payload, { error: "rate_limit_exceeded" });
  assert.equal(limited.authorizationCalls.length, 0);
});

test("propagates authorization denials without constructing a service", async (t) => {
  for (const denial of [
    { status: 401, error: "unauthorized" },
    { status: 403, error: "forbidden" },
    { status: 500, error: "internal_error" },
  ]) {
    await t.test(String(denial.status), async () => {
      const { res, serviceConstructions } = await invoke({}, { authorization: async () => ({ ok: false, ...denial }) });
      assert.equal(res.statusCode, denial.status);
      assert.deepEqual(res.payload, { error: denial.error });
      assert.equal(serviceConstructions, 0);
    });
  }
});

test("keeps query failures controlled and stock-summary fallback tolerant", async () => {
  const primaryFailure = await invoke({}, { productosError: { message: "failed" } });
  assert.equal(primaryFailure.res.statusCode, 500);
  assert.deepEqual(primaryFailure.res.payload, { error: "internal_error" });

  const fallback = await invoke({}, { resumen: null, resumenError: { message: "missing view" } });
  assert.equal(fallback.res.statusCode, 200);
  assert.equal(fallback.res.payload.items[0].stock_efectivo, 3);
  assert.equal(fallback.res.payload.items[0].stock_source, "legacy");
  assert.equal(fallback.res.payload.meta.resumen_ok, false);
});

test("returns existing metadata except tenant metadata and preserves mapped items", async () => {
  const { res } = await invoke({});
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    items: [{
      producto_id: "producto-a", nombre: "A", descripcion: null, precio: 12, estado: "published",
      usa_variantes: true, stock_base: 3, stock_efectivo: 8, stock_source: "view",
    }],
    meta: { source_mode: "tolerante", resumen_ok: true, resumen_count: 1, auth_mode: "bearer_or_cookie" },
  });
  assert.equal(Object.hasOwn(res.payload.meta, "empresa_id"), false);
});

test("constructs service errors as controlled internal errors", async () => {
  const { res } = await invoke({}, { serviceThrows: true });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, { error: "internal_error" });
});

test("consumer statically uses the tenant-free endpoint while retaining bearer and item mapping", async () => {
  const source = await readFile(new URL("../src/pages/panel/productos/index.tsx", import.meta.url), "utf8");
  assert.match(source, /const\s+url\s*=\s*["']\/api\/panel\/productos["'];/);
  assert.match(source, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  assert.match(source, /\(data\.items \?\? \[\]\)\.map/);
  assert.doesNotMatch(source, /api\/panel\/productos\?empresa_id/);
});

test("consumer deletes through the canonical endpoint and never writes producto directly", async () => {
  const source = await readFile(new URL("../src/pages/panel/productos/index.tsx", import.meta.url), "utf8");
  assert.match(source, /`\/api\/panel\/productos\?id=\$\{encodeURIComponent\(id\)\}`/);
  assert.match(source, /method:\s*"DELETE"/);
  assert.doesNotMatch(source, /supabase\s*\.from\(/);
  assert.match(source, /producto_en_pedido_activo/);
});

test("deletes only a product of the canonical tenant", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, authorizationCalls, serviceCalls } = await invoke(
        { method: "DELETE", query: { id: PRODUCTO_ID } },
        { authorization: async () => ({ ok: true, principal: { empresaId } }) },
      );
      assert.equal(res.statusCode, 204);
      assert.equal(res.ended, true);
      assert.deepEqual(authorizationCalls.map((call) => call.slice(1)), [["catalog.operate"]]);
      assert.deepEqual(serviceCalls, [
        { step: "from", table: "producto" },
        { step: "delete", table: "producto" },
        { step: "eq", table: "producto", column: "id", value: PRODUCTO_ID },
        { step: "eq", table: "producto", column: "empresa_id", value: empresaId },
        { step: "select", table: "producto", columns: "id" },
        { step: "maybeSingle", table: "producto" },
      ]);
    });
  }
});

test("maps delete outcomes", async (t) => {
  const cases = [
    ["outside tenant", { data: null, error: null }, 404, "producto_no_encontrado"],
    ["pending order guard", { data: null, error: { code: "55006" } }, 409, "producto_en_pedido_activo"],
    ["restricted reference", { data: null, error: { code: "23503" } }, 409, "producto_en_uso"],
    ["other failure", { data: null, error: { code: "XX000" } }, 500, "internal_error"],
  ];
  for (const [name, deleteResult, status, error] of cases) {
    await t.test(name, async () => {
      const { res } = await invoke({ method: "DELETE", query: { id: PRODUCTO_ID } }, { deleteResult });
      assert.equal(res.statusCode, status);
      assert.deepEqual(res.payload, { error });
    });
  }
});

test("rejects invalid deletes before authorization", async (t) => {
  const cases = [
    ["legacy tenant", { method: "DELETE", query: { id: PRODUCTO_ID, empresa_id: "empresa-b" } }, 400, "legacy_tenant_input"],
    ["missing id", { method: "DELETE" }, 400, "invalid_request"],
    ["invalid id", { method: "DELETE", query: { id: "producto-a" } }, 400, "invalid_request"],
  ];
  for (const [name, requestOptions, status, error] of cases) {
    await t.test(name, async () => {
      const result = await invoke(requestOptions);
      assert.equal(result.res.statusCode, status);
      assert.deepEqual(result.res.payload, { error });
      assert.equal(result.authorizationCalls.length, 0);
      assert.equal(result.serviceConstructions, 0);
    });
  }

  const limited = await invoke({ method: "DELETE", query: { id: PRODUCTO_ID } }, { rateLimit: { ok: false, limit: 30 } });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.authorizationCalls.length, 0);
});

test("deletes require a trusted origin for cookie sessions and authorization before the service", async () => {
  const cookie = await invoke(
    { method: "DELETE", query: { id: PRODUCTO_ID }, headers: { cookie: "sb-access-token=a" } },
    { origin: { ok: false, reason: "untrusted_origin", origin: "https://evil.example" } },
  );
  assert.deepEqual(cookie.originCalls, [{ allowWithoutOrigin: false }]);
  assert.equal(cookie.res.statusCode, 403);
  assert.equal(cookie.authorizationCalls.length, 0);

  const denied = await invoke(
    { method: "DELETE", query: { id: PRODUCTO_ID }, headers: { authorization: "Bearer a" } },
    { authorization: async () => ({ ok: false, status: 403, error: "forbidden" }) },
  );
  assert.deepEqual(denied.originCalls, [{ allowWithoutOrigin: true }]);
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.serviceConstructions, 0);
});
