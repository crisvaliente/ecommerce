import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const API_FILE = new URL("../src/pages/api/panel/categorias.ts", import.meta.url);

const CATEGORIA_ID = "5f2b7c1e-8d4a-4c3b-9e6f-1a2b3c4d5e6f";
const COLUMNS = "id, nombre, slug, descripcion, orden";
const ITEM = { id: CATEGORIA_ID, nombre: "Remeras", slug: "remeras", descripcion: null, orden: 1 };
const VALID_BODY = { nombre: " Remeras ", slug: "remeras", descripcion: "  ", orden: 1 };

function request({ method = "GET", query = {}, body, headers = {} } = {}) {
  return { method, query, body, headers, socket: { remoteAddress: "127.0.0.1" } };
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
  writeResult = { data: ITEM, error: null },
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
        select(columns) { serviceCalls.push({ step: "select", columns }); return this; },
        insert(values) { serviceCalls.push({ step: "insert", values }); return this; },
        update(values) { serviceCalls.push({ step: "update", values }); return this; },
        delete() { serviceCalls.push({ step: "delete" }); return this; },
        eq(column, value) { serviceCalls.push({ step: "eq", column, value }); return this; },
        order(column, options) { serviceCalls.push({ step: "order", column, options }); return this; },
        async returns() { return { data: rows, error: queryError }; },
        async single() { serviceCalls.push({ step: "single" }); return writeResult; },
        async maybeSingle() { serviceCalls.push({ step: "maybeSingle" }); return writeResult; },
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
  const method = await invoke({ method: "PUT", query: { empresa_id: "empresa-a" } });
  assert.equal(method.res.statusCode, 405);
  assert.equal(method.res.headers.Allow, "GET, POST, PATCH, DELETE");
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

test("creates a category only in the canonical authorized tenant", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, authorizationCalls, serviceCalls } = await invoke(
        { method: "POST", body: VALID_BODY, headers: { authorization: "Bearer token-a" } },
        { authorization: async () => ({ ok: true, principal: { empresaId } }) },
      );
      assert.equal(res.statusCode, 201);
      assert.deepEqual(res.payload, { item: ITEM });
      assert.deepEqual(authorizationCalls.map((call) => call.slice(1)), [["catalog.operate"]]);
      assert.deepEqual(serviceCalls, [
        { step: "from", table: "categoria" },
        { step: "insert", values: { empresa_id: empresaId, nombre: "Remeras", slug: "remeras", descripcion: null, orden: 1 } },
        { step: "select", columns: COLUMNS },
        { step: "single" },
      ]);
      assert.equal(res.headers["Cache-Control"], "no-store");
    });
  }
});

test("updates only a category of the canonical tenant", async () => {
  const { res, serviceCalls } = await invoke({
    method: "PATCH",
    query: { id: CATEGORIA_ID },
    body: { nombre: "Remeras", slug: "", descripcion: "Algodón", orden: null },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { item: ITEM });
  const update = serviceCalls.find((call) => call.step === "update");
  assert.equal(typeof update.values.updated_at, "string");
  assert.deepEqual(
    { ...update.values, updated_at: undefined },
    { nombre: "Remeras", slug: null, descripcion: "Algodón", orden: null, updated_at: undefined },
  );
  assert.deepEqual(serviceCalls.filter((call) => call.step === "eq"), [
    { step: "eq", column: "id", value: CATEGORIA_ID },
    { step: "eq", column: "empresa_id", value: "empresa-a" },
  ]);
  assert.deepEqual(serviceCalls.slice(-2), [{ step: "select", columns: COLUMNS }, { step: "maybeSingle" }]);
});

test("a partial update changes only the sent fields", async () => {
  const { res, serviceCalls } = await invoke({ method: "PATCH", query: { id: CATEGORIA_ID }, body: { orden: 3 } });
  assert.equal(res.statusCode, 200);
  const update = serviceCalls.find((call) => call.step === "update");
  assert.deepEqual(Object.keys(update.values).sort(), ["orden", "updated_at"]);
  assert.equal(update.values.orden, 3);
});

test("creating without optional fields sends only the name", async () => {
  const { res, serviceCalls } = await invoke({ method: "POST", body: { nombre: "Remeras" } });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(serviceCalls[1], { step: "insert", values: { empresa_id: "empresa-a", nombre: "Remeras" } });
});

test("deletes only a category of the canonical tenant", async () => {
  const { res, serviceCalls } = await invoke(
    { method: "DELETE", query: { id: CATEGORIA_ID } },
    { writeResult: { data: { id: CATEGORIA_ID }, error: null } },
  );
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.deepEqual(serviceCalls, [
    { step: "from", table: "categoria" },
    { step: "delete" },
    { step: "eq", column: "id", value: CATEGORIA_ID },
    { step: "eq", column: "empresa_id", value: "empresa-a" },
    { step: "select", columns: "id" },
    { step: "maybeSingle" },
  ]);
});

test("a category outside the tenant is reported as not found", async (t) => {
  for (const method of ["PATCH", "DELETE"]) {
    await t.test(method, async () => {
      const { res } = await invoke(
        { method, query: { id: CATEGORIA_ID }, body: method === "PATCH" ? VALID_BODY : undefined },
        { writeResult: { data: null, error: null } },
      );
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.payload, { error: "categoria_no_encontrada" });
    });
  }
});

test("rejects forged tenant input and invalid writes before authorization", async (t) => {
  const cases = [
    ["query tenant", { method: "POST", query: { empresa_id: "empresa-b" }, body: VALID_BODY }, 400, "legacy_tenant_input"],
    ["body tenant", { method: "POST", body: { ...VALID_BODY, empresa_id: "empresa-b" } }, 400, "legacy_tenant_input"],
    ["unknown field", { method: "POST", body: { ...VALID_BODY, parent_id: CATEGORIA_ID } }, 400, "invalid_request"],
    ["missing body", { method: "POST" }, 400, "invalid_request"],
    ["blank name", { method: "POST", body: { ...VALID_BODY, nombre: "   " } }, 400, "invalid_request"],
    ["long name", { method: "POST", body: { ...VALID_BODY, nombre: "a".repeat(256) } }, 400, "invalid_request"],
    ["non-string slug", { method: "POST", body: { ...VALID_BODY, slug: 1 } }, 400, "invalid_request"],
    ["non-integer order", { method: "POST", body: { ...VALID_BODY, orden: 1.5 } }, 400, "invalid_request"],
    ["order above int4", { method: "POST", body: { ...VALID_BODY, orden: 2_147_483_648 } }, 400, "invalid_request"],
    ["long slug", { method: "POST", body: { ...VALID_BODY, slug: "a".repeat(256) } }, 400, "invalid_request"],
    ["create without name", { method: "POST", body: { slug: "remeras" } }, 400, "invalid_request"],
    ["blank name on update", { method: "PATCH", query: { id: CATEGORIA_ID }, body: { nombre: " " } }, 400, "invalid_request"],
    ["empty update", { method: "PATCH", query: { id: CATEGORIA_ID }, body: {} }, 400, "invalid_request"],
    ["patch without id", { method: "PATCH", body: VALID_BODY }, 400, "invalid_request"],
    ["delete with invalid id", { method: "DELETE", query: { id: "categoria-a" } }, 400, "invalid_request"],
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
});

test("writes are rate limited separately and require a trusted origin for cookie sessions", async () => {
  const limited = await invoke({ method: "POST", body: VALID_BODY }, { rateLimit: { ok: false, limit: 30 } });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.authorizationCalls.length, 0);

  const cookie = await invoke(
    { method: "POST", body: VALID_BODY, headers: { cookie: "sb-access-token=a" } },
    { origin: { ok: false, reason: "untrusted_origin", origin: "https://evil.example" } },
  );
  assert.deepEqual(cookie.originCalls, [{ allowWithoutOrigin: false }]);
  assert.equal(cookie.res.statusCode, 403);
  assert.deepEqual(cookie.res.payload, { error: "untrusted_origin" });
  assert.equal(cookie.authorizationCalls.length, 0);

  const bearer = await invoke({ method: "DELETE", query: { id: CATEGORIA_ID }, headers: { authorization: "Bearer a" } });
  assert.deepEqual(bearer.originCalls, [{ allowWithoutOrigin: true }]);
});

test("write authorization denials never construct the service client", async () => {
  const result = await invoke(
    { method: "POST", body: VALID_BODY },
    { authorization: async () => ({ ok: false, status: 403, error: "forbidden" }) },
  );
  assert.equal(result.res.statusCode, 403);
  assert.deepEqual(result.res.payload, { error: "forbidden" });
  assert.equal(result.serviceConstructions, 0);
});

test("maps database conflicts and keeps other write failures internal", async (t) => {
  const cases = [
    ["duplicate name", { method: "POST", body: VALID_BODY }, { code: "23505" }, 409, "categoria_duplicada"],
    ["category in use", { method: "DELETE", query: { id: CATEGORIA_ID } }, { code: "23503" }, 409, "categoria_en_uso"],
    ["other failure", { method: "PATCH", query: { id: CATEGORIA_ID }, body: VALID_BODY }, { code: "XX000" }, 500, "internal_error"],
  ];
  for (const [name, requestOptions, dbError, status, error] of cases) {
    await t.test(name, async () => {
      const result = await invoke(requestOptions, { writeResult: { data: null, error: dbError } });
      assert.equal(result.res.statusCode, status);
      assert.deepEqual(result.res.payload, { error });
    });
  }
  const thrown = await invoke({ method: "POST", body: VALID_BODY }, { serviceThrows: true });
  assert.equal(thrown.res.statusCode, 500);
  assert.deepEqual(thrown.res.payload, { error: "internal_error" });
});
