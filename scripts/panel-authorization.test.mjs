import assert from "node:assert/strict";
import test from "node:test";

import { createPanelAuthorization } from "../src/lib/panelAuthorization.ts";

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EMPRESA_ID = "33333333-3333-4333-8333-333333333333";

function request(headers = { authorization: "Bearer caller-token" }) {
  return { headers };
}

function fixture({
  authData = { user: { id: AUTH_USER_ID } },
  authError = null,
  profileRows = [{ id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "admin", onboarding: false }],
  profileError = null,
  companyRows = [{ id: EMPRESA_ID }],
  companyError = null,
  publicEnv = { supabaseUrl: "https://example.invalid", supabaseAnonKey: "anon-key" },
  serviceKey = "service-key",
  createClientError = null,
} = {}) {
  const counters = {
    callerClient: 0,
    serviceEnv: 0,
    serviceClient: 0,
    privilegedQuery: 0,
  };
  const calls = [];

  function query(table) {
    const builder = {
      select(columns) {
        calls.push({ step: "select", table, columns });
        return this;
      },
      eq(column, value) {
        calls.push({ step: "eq", table, column, value });
        return this;
      },
      limit(count) {
        calls.push({ step: "limit", table, count });
        return this;
      },
      async maybeSingle() {
        if (table === "usuario") {
          return profileRows.length === 1
            ? { data: profileRows[0], error: profileError }
            : { data: null, error: profileError ?? { code: "PGRST116" } };
        }
        return companyRows.length === 1
          ? { data: companyRows[0], error: companyError }
          : { data: null, error: companyError };
      },
      then(resolve, reject) {
        const result = table === "usuario"
          ? { data: profileRows, error: profileError }
          : { data: companyRows, error: companyError };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  const callerClient = {
    auth: {
      async getUser() {
        calls.push({ step: "getUser" });
        return { data: authData, error: authError };
      },
    },
    from(table) {
      calls.push({ step: "from", table, client: "caller" });
      return query(table);
    },
  };
  const serviceClient = {
    from() {
      counters.privilegedQuery += 1;
      return query("privileged");
    },
  };

  const dependencies = {
    readPublicEnv() {
      return publicEnv;
    },
    readServiceRoleKey() {
      counters.serviceEnv += 1;
      return serviceKey;
    },
    createClient(_url, key) {
      if (createClientError) throw createClientError;
      if (key === "anon-key") {
        counters.callerClient += 1;
        return callerClient;
      }
      counters.serviceClient += 1;
      return serviceClient;
    },
    logError(event) {
      calls.push({ step: "log", ...event });
    },
  };

  return { dependencies, counters, calls };
}

async function authorize(options, capability = "panel.enter", requestedEmpresaId = undefined, headers) {
  const state = fixture(options);
  const api = createPanelAuthorization(state.dependencies);
  const result = await api.authorizePanelRequest(request(headers), capability, requestedEmpresaId);
  return { ...state, ...api, result };
}

test("keeps valid admin admission separate from delayed service construction", async () => {
  const { result, counters, createPanelServiceClient, calls } = await authorize();
  assert.deepEqual(result, {
    ok: true,
    principal: { authUserId: AUTH_USER_ID, profileId: PROFILE_ID, role: "admin", empresaId: EMPRESA_ID },
  });
  assert.equal(counters.callerClient, 1);
  assert.equal(counters.serviceEnv, 0);
  assert.equal(counters.serviceClient, 0);
  createPanelServiceClient();
  assert.equal(counters.serviceEnv, 1);
  assert.equal(counters.serviceClient, 1);
  assert.deepEqual(calls.filter(({ step }) => step === "from").map(({ table }) => table), ["usuario", "empresa"]);
});

test("does not read service configuration when authentication is rejected", async () => {
  const { result, counters } = await authorize({
    authData: { user: null },
    authError: { status: 401, name: "AuthApiError" },
  });
  assert.deepEqual(result, { ok: false, status: 401, error: "unauthorized" });
  assert.equal(counters.serviceEnv, 0);
  assert.equal(counters.serviceClient, 0);
});

test("maps authentication infrastructure errors to internal_error", async () => {
  const { result } = await authorize({
    authData: { user: null },
    authError: { status: 503, name: "AuthRetryableFetchError" },
  });
  assert.deepEqual(result, { ok: false, status: 500, error: "internal_error" });
});

test("denies duplicate canonical profiles rather than treating them as infrastructure", async () => {
  const row = { id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "admin", onboarding: false };
  const { result } = await authorize({ profileRows: [row, { ...row, id: AUTH_USER_ID }] });
  assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
});

test("denies malformed profiles and orphan companies", async (t) => {
  const invalidProfiles = [
    { id: "not-a-uuid", empresa_id: EMPRESA_ID, rol: "admin", onboarding: false },
    { id: PROFILE_ID, empresa_id: "bad-company", rol: "admin", onboarding: false },
    { id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "owner", onboarding: false },
    { id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "admin", onboarding: "false" },
    { id: PROFILE_ID, empresa_id: null, rol: "admin", onboarding: false },
    { id: PROFILE_ID, empresa_id: null, rol: "staff", onboarding: true },
    { id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "staff", onboarding: true },
  ];
  for (const [index, profile] of invalidProfiles.entries()) {
    await t.test(`invalid profile ${index + 1}`, async () => {
      const { result } = await authorize({ profileRows: [profile] });
      assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
    });
  }
  for (const companyRows of [[], [{ id: EMPRESA_ID }, { id: EMPRESA_ID }], [{ id: AUTH_USER_ID }]]) {
    await t.test(`invalid company result count ${companyRows.length}`, async () => {
      const { result } = await authorize({ companyRows });
      assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
    });
  }
});

test("denies zero profiles and maps profile or company lookup errors to 500", async (t) => {
  const cases = [
    [{ profileRows: [] }, 403],
    [{ profileError: { code: "XX001" } }, 500],
    [{ companyError: { code: "XX002" } }, 500],
  ];
  for (const [options, status] of cases) {
    await t.test(`status ${status} for ${JSON.stringify(options)}`, async () => {
      const { result, counters } = await authorize(options);
      assert.equal(result.ok, false);
      assert.equal(result.status, status);
      assert.equal(counters.serviceEnv, 0);
      assert.equal(counters.serviceClient, 0);
      assert.equal(counters.privilegedQuery, 0);
    });
  }
});

test("admits staff only for its granted resolver capabilities", async () => {
  const profileRows = [{ id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "staff", onboarding: false }];
  for (const capability of ["panel.enter", "catalog.operate", "orders.operate"]) {
    const { result } = await authorize({ profileRows }, capability);
    assert.equal(result.ok, true, capability);
  }
  for (const capability of ["orders.cancel", "payments.access", "companyRoles.admin", "unknown.capability"]) {
    const { result, counters } = await authorize({ profileRows }, capability);
    assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" }, capability);
    assert.equal(counters.serviceEnv, 0);
  }
});

test("always denies bound and legitimate onboarding cliente profiles", async () => {
  const profiles = [
    { id: PROFILE_ID, empresa_id: EMPRESA_ID, rol: "cliente", onboarding: false },
    { id: PROFILE_ID, empresa_id: null, rol: "cliente", onboarding: true },
  ];
  for (const profile of profiles) {
    const { result } = await authorize({ profileRows: [profile] }, "panel.enter");
    assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
  }
});

test("uses header precedence, cookie fallback, and authoritative auth UID", async () => {
  const cookie = await authorize({}, "panel.enter", undefined, { cookie: "x=1; sb-access-token=cookie-token" });
  assert.equal(cookie.result.ok, true);
  const headerWins = await authorize({}, "panel.enter", undefined, {
    authorization: "invalid",
    cookie: "sb-access-token=cookie-token",
  });
  assert.deepEqual(headerWins.result, { ok: false, status: 401, error: "unauthorized" });
  const { calls } = await authorize();
  assert.ok(calls.some((call) => call.step === "eq" && call.table === "usuario" &&
    call.column === "supabase_uid" && call.value === AUTH_USER_ID));
});

test("returns 401 for missing, malformed, and rejected credentials", async () => {
  for (const headers of [{}, { authorization: "Bearer bad token" }, { cookie: "sb-access-token=%" }]) {
    const { result } = await authorize({}, "panel.enter", undefined, headers);
    assert.deepEqual(result, { ok: false, status: 401, error: "unauthorized" });
  }
  const { result } = await authorize({ authData: { user: null }, authError: null });
  assert.deepEqual(result, { ok: false, status: 401, error: "unauthorized" });
});

test("preserves requested company comparison without granting request authority", async () => {
  assert.equal((await authorize({}, "catalog.operate", EMPRESA_ID)).result.ok, true);
  const mismatch = await authorize({}, "catalog.operate", AUTH_USER_ID);
  assert.deepEqual(mismatch.result, { ok: false, status: 403, error: "forbidden" });
  assert.equal(mismatch.counters.serviceEnv, 0);
});

test("maps missing or thrown public configuration and client failures to 500", async () => {
  for (const options of [
    { publicEnv: {} },
    { createClientError: new Error("construction failed") },
  ]) {
    const { result, counters } = await authorize(options);
    assert.deepEqual(result, { ok: false, status: 500, error: "internal_error" });
    assert.equal(counters.serviceEnv, 0);
  }
});

test("authorized service factory fails closed for missing service configuration", async () => {
  const { result, createPanelServiceClient } = await authorize({ serviceKey: null });
  assert.equal(result.ok, true);
  assert.throws(() => createPanelServiceClient(), /panel_service_config_unavailable/);
});
