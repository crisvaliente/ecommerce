import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const API_FILE = new URL("../src/pages/api/panel/categorias.ts", import.meta.url);

function request({ method = "GET", query = {} } = {}) {
  return { method, query, headers: {}, socket: { remoteAddress: "127.0.0.1" } };
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
  const source = await readFile(API_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "categorias.ts",
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function (id, parent, isMain) {
    if (id === "../../../lib/apiSecurity") return dependencies.security;
    if (id === "../../../lib/panelAuthorization") return dependencies.authorization;
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    const loaded = new Module(API_FILE.pathname);
    loaded.filename = API_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, API_FILE.pathname);
    return loaded.exports.default;
  } finally {
    Module._load = originalLoad;
  }
}

function fixture({
  authorization = async () => ({ ok: true, principal: { empresaId: "empresa-a" } }),
  rateLimit = { ok: true, limit: 60, remaining: 59, retryAfterSeconds: 60 },
  rows = [{ id: "categoria-a", nombre: "A", slug: "a", descripcion: null, orden: null }],
  queryError = null,
  serviceThrows = false,
} = {}) {
  const authorizationCalls = [];
  const serviceCalls = [];
  let serviceConstructions = 0;
  const service = {
    from(table) {
      serviceCalls.push({ step: "from", table });
      return {
        select(columns) { serviceCalls.push({ step: "select", columns }); return this; },
        eq(column, value) { serviceCalls.push({ step: "eq", column, value }); return this; },
        order(column, options) { serviceCalls.push({ step: "order", column, options }); return this; },
        async returns() { return { data: rows, error: queryError }; },
      };
    },
  };
  return {
    authorizationCalls,
    serviceCalls,
    get serviceConstructions() { return serviceConstructions; },
    dependencies: {
      security: {
        checkRateLimit() { return rateLimit; },
        applyRateLimitHeaders(res, result) { res.setHeader("X-RateLimit-Limit", String(result.limit)); },
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

test("uses only the canonical authorized tenant and category listing contract", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, authorizationCalls, serviceCalls } = await invoke({}, {
        authorization: async () => ({ ok: true, principal: { empresaId } }),
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.payload, { items: [{ id: "categoria-a", nombre: "A", slug: "a", descripcion: null, orden: null }] });
      assert.deepEqual(authorizationCalls.map((call) => call.slice(1)), [["catalog.operate"]]);
      assert.deepEqual(serviceCalls, [
        { step: "from", table: "categoria" },
        { step: "select", columns: "id, nombre, slug, descripcion, orden" },
        { step: "eq", column: "empresa_id", value: empresaId },
        { step: "order", column: "orden", options: { ascending: true, nullsFirst: true } },
      ]);
      assert.equal(res.headers["Cache-Control"], "no-store");
    });
  }
});

test("rejects method, rate limit, and forged tenant input before authorization", async () => {
  const method = await invoke({ method: "POST", query: { empresa_id: "empresa-a" } });
  assert.equal(method.res.statusCode, 405);
  assert.equal(method.res.headers.Allow, "GET");
  assert.equal(method.authorizationCalls.length, 0);

  const limited = await invoke({ query: { empresa_id: "empresa-a" } }, { rateLimit: { ok: false, limit: 60 } });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.authorizationCalls.length, 0);

  const forged = await invoke({ query: { empresa_id: "empresa-b" } });
  assert.equal(forged.res.statusCode, 400);
  assert.deepEqual(forged.res.payload, { error: "legacy_tenant_input" });
  assert.equal(forged.authorizationCalls.length, 0);
  assert.equal(forged.serviceConstructions, 0);
});

test("delegates a credentialless request to canonical authorization", async () => {
  const result = await invoke({}, {
    authorization: async (req) => {
      assert.deepEqual(req.headers, {});
      return { ok: false, status: 401, error: "unauthorized" };
    },
  });
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.res.payload, { error: "unauthorized" });
  assert.deepEqual(result.authorizationCalls.map((call) => call.slice(1)), [["catalog.operate"]]);
  assert.equal(result.serviceConstructions, 0);
});

test("propagates authorization and keeps database failures internal", async (t) => {
  for (const denial of [{ status: 401, error: "unauthorized" }, { status: 403, error: "forbidden" }]) {
    await t.test(String(denial.status), async () => {
      const result = await invoke({}, { authorization: async () => ({ ok: false, ...denial }) });
      assert.equal(result.res.statusCode, denial.status);
      assert.deepEqual(result.res.payload, { error: denial.error });
      assert.equal(result.serviceConstructions, 0);
    });
  }
  for (const options of [{ queryError: { message: "database" } }, { serviceThrows: true }]) {
    const result = await invoke({}, options);
    assert.equal(result.res.statusCode, 500);
    assert.deepEqual(result.res.payload, { error: "internal_error" });
  }
});

test("returns empty canonical category lists", async () => {
  const { res } = await invoke({}, { rows: null });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { items: [] });
});
