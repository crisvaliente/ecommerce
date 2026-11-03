import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const API_FILE = new URL("../src/pages/api/panel/pagos.ts", import.meta.url);

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
    fileName: "pagos.ts",
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
  row = null,
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
        async maybeSingle() { serviceCalls.push({ step: "maybeSingle" }); return { data: row, error: queryError }; },
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

test("rejects non-GET methods before authorization", async () => {
  for (const method of ["POST", "PATCH", "DELETE", "PUT"]) {
    const result = await invoke({ method });
    assert.equal(result.res.statusCode, 405);
    assert.equal(result.res.headers.Allow, "GET");
    assert.equal(result.authorizationCalls.length, 0);
  }
});

test("rejects a rate-limited request before authorization", async () => {
  const result = await invoke({}, { rateLimit: { ok: false, limit: 60 } });
  assert.equal(result.res.statusCode, 429);
  assert.equal(result.authorizationCalls.length, 0);
});

test("rejects any forged empresa_id input before authorization", async (t) => {
  for (const [name, requestOptions] of [
    ["query", { query: { empresa_id: "empresa-b" } }],
    ["body", { method: "GET", body: { empresa_id: "empresa-b" } }],
  ]) {
    await t.test(name, async () => {
      const result = await invoke(requestOptions);
      assert.equal(result.res.statusCode, 400);
      assert.deepEqual(result.res.payload, { error: "legacy_tenant_input" });
      assert.equal(result.authorizationCalls.length, 0);
      assert.equal(result.serviceConstructions, 0);
    });
  }
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
  assert.deepEqual(result.authorizationCalls.map((call) => call.slice(1)), [["payments.access"]]);
  assert.equal(result.serviceConstructions, 0);
});

test("propagates authorization denials", async (t) => {
  for (const denial of [{ status: 401, error: "unauthorized" }, { status: 403, error: "forbidden" }]) {
    await t.test(String(denial.status), async () => {
      const result = await invoke({}, { authorization: async () => ({ ok: false, ...denial }) });
      assert.equal(result.res.statusCode, denial.status);
      assert.deepEqual(result.res.payload, { error: denial.error });
      assert.equal(result.serviceConstructions, 0);
    });
  }
});

test("returns the configured, live-mode state for the canonical tenant only", async (t) => {
  for (const empresaId of ["empresa-a", "empresa-b"]) {
    await t.test(empresaId, async () => {
      const { res, serviceCalls } = await invoke({}, {
        authorization: async () => ({ ok: true, principal: { empresaId } }),
        row: { live_mode: true, estado: "activo" },
      });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.payload, { configurado: true, live_mode: true, estado: "activo" });
      assert.deepEqual(serviceCalls, [
        { step: "from", table: "empresa_mercadopago" },
        { step: "select", columns: "live_mode, estado" },
        { step: "eq", column: "empresa_id", value: empresaId },
        { step: "maybeSingle" },
      ]);
      assert.equal(res.headers["Cache-Control"], "no-store");
    });
  }
});

test("returns the inactive state", async () => {
  const { res } = await invoke({}, { row: { live_mode: false, estado: "inactivo" } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { configurado: true, live_mode: false, estado: "inactivo" });
});

test("returns the absent state when the store has no row", async () => {
  const { res } = await invoke({}, { row: null });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { configurado: false, live_mode: null, estado: null });
});

test("never returns the account id, webhook key, ciphertext or key version", async () => {
  const { res } = await invoke({}, {
    row: {
      live_mode: true,
      estado: "activo",
      mp_user_id: 999,
      webhook_key: "leaked-key",
      access_token_enc: "v1:leaked",
      key_version: 1,
    },
  });
  assert.deepEqual(Object.keys(res.payload).sort(), ["configurado", "estado", "live_mode"]);
});

test("a read error answers 500 internal_error", async (t) => {
  for (const options of [{ queryError: { message: "database" } }, { serviceThrows: true }]) {
    await t.test(JSON.stringify(options), async () => {
      const result = await invoke({}, options);
      assert.equal(result.res.statusCode, 500);
      assert.deepEqual(result.res.payload, { error: "internal_error" });
    });
  }
});

test("the payments page renders accented copy, never JavaScript escapes in JSX text", async () => {
  const page = await readFile(new URL("../src/pages/panel/payments.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /\\u[0-9a-fA-F]{4}/);
  for (const copy of ["No se encontró información de empresa asociada.", "Reintentá más tarde.", "Desde acá vas a ver el estado de la integración"]) {
    assert.ok(page.includes(copy), copy);
  }
});
