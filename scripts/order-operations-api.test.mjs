import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createOrderDetailHandler } from "../src/lib/orderOperationsApi.ts";

const PEDIDO_ID = "11111111-1111-4111-8111-111111111111";
const EMPRESA_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function request({ method = "PATCH", id = PEDIDO_ID, body, headers = {} } = {}) {
  return {
    method,
    query: { id },
    body,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function transitionResult(overrides = {}) {
  return {
    ok: true,
    codigo_resultado: "transicion_aplicada",
    pedido_id: PEDIDO_ID,
    estado_anterior: "pagado",
    estado_final: "en_preparacion",
    evento_id: "44444444-4444-4444-8444-444444444444",
    idempotente: false,
    ...overrides,
  };
}

function setup({ role = "staff", rpcData = [transitionResult()], rpcError = null, authorization } = {}) {
  const rpcCalls = [];
  const supabaseAdmin = {
    async rpc(name, params) {
      rpcCalls.push({ name, params });
      return { data: rpcData, error: rpcError };
    },
  };
  const authorize = authorization ?? (async () => ({
    ok: true,
    userId: USER_ID,
    empresaId: EMPRESA_ID,
    role,
    supabaseAdmin,
  }));
  return {
    handler: createOrderDetailHandler({
      authorizePanelAccess: authorize,
      applyRateLimitHeaders(res, result) {
        res.setHeader("X-RateLimit-Limit", String(result.limit));
      },
      checkRateLimit() {
        return { ok: true, limit: 30, remaining: 29, retryAfterSeconds: 60 };
      },
      hasBearerAuthorization(req) {
        return typeof req.headers.authorization === "string";
      },
      hasSessionAccessCookie(req) {
        return typeof req.headers.cookie === "string" && req.headers.cookie.includes("sb-access-token=");
      },
      validateTrustedOrigin(req, options) {
        if (typeof req.headers.origin === "string") return { ok: true };
        return options.allowWithoutOrigin ? { ok: true } : { ok: false, reason: "missing_origin" };
      },
      async getHandler(_req, res) {
        return res.status(200).json({ pedido: {} });
      },
    }),
    rpcCalls,
  };
}

async function invoke(options, setupOptions) {
  const fixture = setup(setupOptions);
  const res = response();
  await fixture.handler(request(options), res);
  return { ...fixture, res };
}

const logisticsBody = {
  expected_state: "pagado",
  target_state: "en_preparacion",
};

test("returns 401 when panel authorization reports unauthenticated", async () => {
  const { res } = await invoke(
    { body: logisticsBody },
    { authorization: async () => ({ ok: false, status: 401, error: "unauthorized" }) },
  );
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, { error: "unauthorized" });
});

test("returns 403 when authenticated user has no panel role", async () => {
  const { res } = await invoke(
    { body: logisticsBody },
    { authorization: async () => ({ ok: false, status: 403, error: "forbidden" }) },
  );
  assert.equal(res.statusCode, 403);
});

test("returns 405 with the complete Allow header", async () => {
  const { res } = await invoke({ method: "POST", body: logisticsBody });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET, PATCH");
});

test("rejects invalid UUID, payload shape and states", async (t) => {
  const cases = [
    { id: "not-a-uuid", body: logisticsBody },
    { body: null },
    { body: { ...logisticsBody, empresa_id: EMPRESA_ID } },
    { body: { expected_state: "unknown", target_state: "en_preparacion" } },
    { body: { expected_state: "pagado", target_state: "unknown" } },
    { body: { expected_state: "pagado", target_state: "enviado" } },
    { body: { ...logisticsBody, motivo: "x".repeat(501) } },
  ];
  for (const options of cases) {
    await t.test(JSON.stringify(options), async () => {
      const { res, rpcCalls } = await invoke(options);
      assert.equal(res.statusCode, 400);
      assert.equal(rpcCalls.length, 0);
    });
  }
});

test("returns the same non-revealing 404 for missing and cross-tenant orders", async (t) => {
  for (const code of ["pedido_no_encontrado", "empresa_no_coincide"]) {
    await t.test(code, async () => {
      const { res } = await invoke(
        { body: logisticsBody },
        { rpcData: [transitionResult({ ok: false, codigo_resultado: code })] },
      );
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.payload, { error: "pedido_no_encontrado" });
    });
  }
});

test("staff can advance every logistics transition using only the session tenant and actor", async (t) => {
  const transitions = [
    ["pagado", "en_preparacion"],
    ["en_preparacion", "enviado"],
    ["enviado", "entregado"],
  ];
  for (const [expectedState, targetState] of transitions) {
    await t.test(`${expectedState} -> ${targetState}`, async () => {
      const result = transitionResult({ estado_anterior: expectedState, estado_final: targetState });
      const { res, rpcCalls } = await invoke(
        { body: { expected_state: expectedState, target_state: targetState, motivo: "Packed" } },
        { rpcData: [result] },
      );
      assert.equal(res.statusCode, 200);
      assert.deepEqual(rpcCalls[0], {
        name: "transicionar_pedido_operacional",
        params: {
          p_pedido_id: PEDIDO_ID,
          p_empresa_id: EMPRESA_ID,
          p_expected_state: expectedState,
          p_target_state: targetState,
          p_actor_id: USER_ID,
          p_motivo: "Packed",
        },
      });
    });
  }
});

test("admin can advance every logistics transition", async (t) => {
  const transitions = [
    ["pagado", "en_preparacion"],
    ["en_preparacion", "enviado"],
    ["enviado", "entregado"],
  ];
  for (const [expectedState, targetState] of transitions) {
    await t.test(`${expectedState} -> ${targetState}`, async () => {
      const result = transitionResult({ estado_anterior: expectedState, estado_final: targetState });
      const { res } = await invoke(
        { body: { expected_state: expectedState, target_state: targetState } },
        { role: "admin", rpcData: [result] },
      );
      assert.equal(res.statusCode, 200);
    });
  }
});

test("staff cannot cancel pending payment orders", async () => {
  const { res, rpcCalls } = await invoke({
    body: { expected_state: "pendiente_pago", target_state: "cancelado" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(rpcCalls.length, 0);
});

test("admin can safely cancel a pending payment order", async () => {
  const body = { expected_state: "pendiente_pago", target_state: "cancelado", motivo: "Duplicate" };
  const result = transitionResult({
    estado_anterior: "pendiente_pago",
    estado_final: "cancelado",
  });
  const { res, rpcCalls } = await invoke({ body }, { role: "admin", rpcData: [result] });
  assert.equal(res.statusCode, 200);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].params.p_empresa_id, EMPRESA_ID);
  assert.equal(rpcCalls[0].params.p_actor_id, USER_ID);
});

test("maps stale transitions to 409", async () => {
  const { res } = await invoke(
    { body: logisticsBody },
    { rpcData: [transitionResult({ ok: false, codigo_resultado: "expected_state_stale" })] },
  );
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.payload, { error: "expected_state_stale" });
});

test("rejects invalid transitions before invoking the RPC", async () => {
  const { res, rpcCalls } = await invoke({
    body: { expected_state: "enviado", target_state: "en_preparacion" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(rpcCalls.length, 0);
});

test("maps an RPC-invalid transition to 409", async () => {
  const { res } = await invoke(
    { body: logisticsBody },
    { rpcData: [transitionResult({ ok: false, codigo_resultado: "transicion_no_permitida" })] },
  );
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.payload, { error: "transicion_no_permitida" });
});

test("returns a controlled error when the RPC fails", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { res } = await invoke(
      { body: logisticsBody },
      { rpcError: { code: "XX999", message: "sensitive database detail" }, rpcData: null },
    );
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: "internal_error" });
    assert.doesNotMatch(JSON.stringify(res.payload), /sensitive/i);
  } finally {
    console.error = originalError;
  }
});

test("cookie-authenticated PATCH requires a trusted origin", async () => {
  const { res, rpcCalls } = await invoke({
    body: logisticsBody,
    headers: { cookie: "sb-access-token=token" },
  });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: "missing_origin" });
  assert.equal(rpcCalls.length, 0);
});

test("endpoint source does not update pedido directly", async () => {
  const endpointSource = await readFile(
    new URL("../src/pages/api/panel/pedidos/[id].ts", import.meta.url),
    "utf8",
  );
  const operationSource = await readFile(
    new URL("../src/lib/orderOperationsApi.ts", import.meta.url),
    "utf8",
  );
  const source = `${endpointSource}\n${operationSource}`;
  assert.doesNotMatch(source, /\.from\(["']pedido["']\)[\s\S]{0,300}?\.update\s*\(/);
  assert.equal((source.match(/\.rpc\(\s*["']transicionar_pedido_operacional["']/g) ?? []).length, 1);
});
