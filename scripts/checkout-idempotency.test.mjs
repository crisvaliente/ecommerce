import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckoutRequestFingerprint,
  parseIdempotencyKey,
} from "../src/lib/checkoutIdempotency.ts";
import {
  assertPreferenceMatchesPersisted,
  createMercadoPagoPreference,
  getPreferenceResolutionMode,
  isManualPreferenceRetryAllowed,
  MercadoPagoBridgeError,
  reconcileMercadoPagoPreference,
  recoverMercadoPagoPreference,
  searchMercadoPagoPreferenceIds,
} from "../src/lib/mercadoPagoPreference.ts";

const INTENTO_ID = "11111111-1111-4111-8111-111111111111";
const PEDIDO_ID = "22222222-2222-4222-8222-222222222222";
const EXPIRATION = "2030-01-01T00:00:00.000Z";
const EXPECTED = {
  intentoPagoId: INTENTO_ID,
  pedidoId: PEDIDO_ID,
  total: 1250,
  dateOfExpiration: EXPIRATION,
};

function compatiblePreference(id = "pref-1", overrides = {}) {
  return {
    id,
    init_point: `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${id}`,
    external_reference: INTENTO_ID,
    expires: true,
    date_of_expiration: EXPIRATION,
    status: "active",
    items: [{
      id: PEDIDO_ID,
      quantity: 1,
      unit_price: 1250,
      currency_id: "UYU",
    }],
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("accepts UUID idempotency keys and rejects malformed values", () => {
  const key = "8e785a0d-655a-4a50-a9ca-d440773640e6";
  assert.equal(parseIdempotencyKey(key), key);
  assert.equal(parseIdempotencyKey([key]), null);
  assert.equal(parseIdempotencyKey("not-a-uuid"), null);
  assert.equal(parseIdempotencyKey(undefined), null);
});

test("canonical fingerprint ignores item order and normalizes UUID/string representations", () => {
  const left = createCheckoutRequestFingerprint({
    empresaId: "3C3D79BC-DFB6-44A3-91D0-48F23C21F226",
    direccionEnvioId: undefined,
    items: [
      { producto_id: " B0000000-0000-4000-8000-000000000002 ", variante_id: "", cantidad: "2" },
      { producto_id: "a0000000-0000-4000-8000-000000000001", variante_id: null, cantidad: 1 },
    ],
  });
  const right = createCheckoutRequestFingerprint({
    empresaId: "3c3d79bc-dfb6-44a3-91d0-48f23c21f226",
    direccionEnvioId: null,
    items: [
      { producto_id: "a0000000-0000-4000-8000-000000000001", variante_id: null, cantidad: "1" },
      { producto_id: "b0000000-0000-4000-8000-000000000002", variante_id: null, cantidad: 2 },
    ],
  });

  assert.match(left, /^[a-f0-9]{64}$/);
  assert.equal(left, right);
});

test("fingerprint changes when checkout semantics change", () => {
  const base = {
    empresaId: "3c3d79bc-dfb6-44a3-91d0-48f23c21f226",
    direccionEnvioId: null,
    items: [{ producto_id: "a0000000-0000-4000-8000-000000000001", variante_id: null, cantidad: 1 }],
  };

  assert.notEqual(
    createCheckoutRequestFingerprint(base),
    createCheckoutRequestFingerprint({ ...base, items: [{ ...base.items[0], cantidad: 2 }] }),
  );
});

test("bridge state separates claim, in-progress, stale reconciliation and reuse", () => {
  const base = {
    preference_id: null,
    preference_init_point: null,
    preference_creation_started_at: null,
  };
  assert.equal(getPreferenceResolutionMode({ ...base, preference_creation_state: "not_started" }), "claim");
  assert.equal(getPreferenceResolutionMode({
    ...base,
    preference_creation_state: "creating",
    preference_creation_started_at: "2030-01-01T00:00:00.000Z",
  }, { nowMs: Date.parse("2030-01-01T00:00:10.000Z") }), "in_progress");
  assert.equal(getPreferenceResolutionMode({
    ...base,
    preference_creation_state: "creating",
    preference_creation_started_at: "2030-01-01T00:00:00.000Z",
  }, { nowMs: Date.parse("2030-01-01T00:01:00.000Z") }), "reconcile");
  assert.equal(getPreferenceResolutionMode({ ...base, preference_creation_state: "ambiguous" }), "reconcile");
  assert.equal(getPreferenceResolutionMode({ ...base, preference_creation_state: "failed" }), "failed");
  assert.equal(getPreferenceResolutionMode({
    ...base,
    preference_creation_state: "ambiguous",
    preference_id: "pref-existing",
  }), "recover");
  assert.equal(getPreferenceResolutionMode({
    ...base,
    preference_creation_state: "ready",
    preference_id: "pref-existing",
    preference_init_point: "https://pay.example/ready",
  }), "reuse");
});

test("local persistence failure leaves the claim non-repeatable and later reconcilable", () => {
  const stateAfterProviderSuccess = {
    preference_id: null,
    preference_init_point: null,
    preference_creation_state: "creating",
    preference_creation_started_at: "2030-01-01T00:00:00.000Z",
  };
  assert.equal(
    getPreferenceResolutionMode(stateAfterProviderSuccess, {
      nowMs: Date.parse("2030-01-01T00:00:05.000Z"),
    }),
    "in_progress",
  );
  assert.equal(
    getPreferenceResolutionMode(stateAfterProviderSuccess, {
      nowMs: Date.parse("2030-01-01T00:01:00.000Z"),
    }),
    "reconcile",
  );
});

test("claimant creates once without X-Idempotency-Key and validates through GET", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return calls.length === 1
      ? jsonResponse({ id: "pref-1" }, 201)
      : jsonResponse(compatiblePreference("pref-1"));
  };

  const result = await createMercadoPagoPreference({
    fetchImpl,
    accessToken: "token",
    expected: EXPECTED,
    notificationUrl: "https://shop.example/api/webhooks/mercadopago",
    backUrls: {
      success: "https://shop.example/checkout/resultado?status=success",
      failure: "https://shop.example/checkout/resultado?status=failure",
      pending: "https://shop.example/checkout/resultado?status=pending",
    },
  });

  assert.equal(result.id, "pref-1");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-Idempotency-Key"], undefined);
  assert.match(calls[1].url, /checkout\/preferences\/pref-1$/);
});

test("definitive provider rejection is failed, not ambiguous", async () => {
  await assert.rejects(
    createMercadoPagoPreference({
      fetchImpl: async () => jsonResponse({ error: "invalid_preference" }, 400),
      accessToken: "token",
      expected: EXPECTED,
      notificationUrl: "https://shop.example/webhook",
      backUrls: { success: "https://shop/s", failure: "https://shop/f", pending: "https://shop/p" },
    }),
    (error) => error instanceof MercadoPagoBridgeError && !error.ambiguous,
  );
});

test("timeouts and provider 5xx remain ambiguous and manual retry only accepts empty failed state", async () => {
  for (const status of [408, 429, 500, 503]) {
    await assert.rejects(
      createMercadoPagoPreference({
        fetchImpl: async () => jsonResponse({ error: "temporary" }, status),
        accessToken: "token",
        expected: EXPECTED,
        notificationUrl: "https://shop.example/webhook",
        backUrls: { success: "https://shop/s", failure: "https://shop/f", pending: "https://shop/p" },
      }),
      (error) => error instanceof MercadoPagoBridgeError && error.ambiguous,
    );
  }

  const failed = {
    preference_id: null,
    preference_init_point: null,
    preference_creation_state: "failed",
    preference_creation_started_at: null,
  };
  assert.equal(isManualPreferenceRetryAllowed(failed, true), true);
  assert.equal(isManualPreferenceRetryAllowed(failed, false), false);
  assert.equal(isManualPreferenceRetryAllowed({ ...failed, preference_creation_state: "ambiguous" }, true), false);
  assert.equal(isManualPreferenceRetryAllowed({ ...failed, preference_id: "pref-1" }, true), false);
  assert.equal(isManualPreferenceRetryAllowed({ ...failed, preference_init_point: "https://mp.example" }, true), false);
});

test("payment endpoint guards manual failed reset with CAS and preserves the single claimant", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/pages/api/ecommerce/intento-pago.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /retry_failed_preference === true/);
  assert.match(source, /isManualPreferenceRetryAllowed\(intento, manualPreferenceRetry\)/);
  assert.match(source, /\.eq\("preference_creation_state", "failed"\)/);
  assert.match(source, /\.is\("preference_id", null\)/);
  assert.match(source, /\.is\("preference_init_point", null\)/);
  assert.match(source, /\.eq\("preference_creation_state", "not_started"\)/);
  assert.match(source, /preference_creation_state: "creating"/);
});

test("network failure after dispatch is ambiguous and never retries inside create", async () => {
  let postCalls = 0;
  await assert.rejects(
    createMercadoPagoPreference({
      fetchImpl: async () => {
        postCalls += 1;
        throw new Error("simulated_timeout");
      },
      accessToken: "token",
      expected: EXPECTED,
      notificationUrl: "https://shop.example/webhook",
      backUrls: { success: "https://shop/s", failure: "https://shop/f", pending: "https://shop/p" },
    }),
    (error) => error instanceof MercadoPagoBridgeError && error.ambiguous,
  );
  assert.equal(postCalls, 1);
});

test("search walks all pages and returns exact external-reference candidates", async () => {
  const offsets = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset"));
    offsets.push(offset);
    assert.equal(parsed.searchParams.get("external_reference"), INTENTO_ID);
    if (offset === 0) {
      return jsonResponse({
        elements: [{ id: "pref-a", external_reference: INTENTO_ID }],
        next_offset: 1,
        total: 2,
      });
    }
    return jsonResponse({
      elements: [{ id: "pref-b", external_reference: INTENTO_ID }],
      next_offset: 2,
      total: 2,
    });
  };

  assert.deepEqual(await searchMercadoPagoPreferenceIds({
    fetchImpl,
    accessToken: "token",
    externalReference: INTENTO_ID,
  }), ["pref-a", "pref-b"]);
  assert.deepEqual(offsets, [0, 1]);
});

test("reconciliation accepts exactly one compatible preference", async () => {
  let calls = 0;
  const resolved = await reconcileMercadoPagoPreference({
    fetchImpl: async (url) => {
      calls += 1;
      return url.includes("/search")
        ? jsonResponse({ elements: [{ id: "pref-only", external_reference: INTENTO_ID }], total: 1 })
        : jsonResponse(compatiblePreference("pref-only"));
    },
    accessToken: "token",
    expected: EXPECTED,
  });
  assert.equal(resolved.id, "pref-only");
  assert.equal(calls, 2);
});

test("reconciliation fails closed for zero, multiple, incompatible and search errors", async () => {
  const scenarios = [
    async () => jsonResponse({ elements: [], total: 0 }),
    async () => jsonResponse({
      elements: [
        { id: "pref-a", external_reference: INTENTO_ID },
        { id: "pref-b", external_reference: INTENTO_ID },
      ],
      total: 2,
    }),
    async (url) => url.includes("/search")
      ? jsonResponse({ elements: [{ id: "pref-bad", external_reference: INTENTO_ID }], total: 1 })
      : jsonResponse(compatiblePreference("pref-bad", { items: [{
          id: PEDIDO_ID,
          quantity: 1,
          unit_price: 999,
          currency_id: "UYU",
        }] })),
    async () => { throw new Error("search_timeout"); },
  ];

  for (const fetchImpl of scenarios) {
    await assert.rejects(
      reconcileMercadoPagoPreference({ fetchImpl, accessToken: "token", expected: EXPECTED }),
      MercadoPagoBridgeError,
    );
  }
});

test("ID-only recovery validates identity, amount, currency, items and usability", async () => {
  const recovered = await recoverMercadoPagoPreference({
    fetchImpl: async () => jsonResponse(compatiblePreference("pref-existing")),
    accessToken: "token",
    preferenceId: "pref-existing",
    expected: EXPECTED,
  });
  assert.equal(recovered.id, "pref-existing");

  for (const overrides of [
    { external_reference: "other" },
    { expires: false },
    { date_of_expiration: "2020-01-01T00:00:00.000Z" },
    { status: "inactive" },
    { items: [{ id: "other", quantity: 1, unit_price: 1250, currency_id: "UYU" }] },
    { items: [{ id: PEDIDO_ID, quantity: 1, unit_price: 1250, currency_id: "USD" }] },
  ]) {
    await assert.rejects(
      recoverMercadoPagoPreference({
        fetchImpl: async () => jsonResponse(compatiblePreference("pref-existing", overrides)),
        accessToken: "token",
        preferenceId: "pref-existing",
        expected: EXPECTED,
      }),
      /mercadopago_preference_mismatch/,
    );
  }
});

test("persisted ready state must match provider result", () => {
  const preference = {
    id: "pref-ready",
    init_point: "https://pay.example/ready",
    external_reference: INTENTO_ID,
  };
  assert.doesNotThrow(() => assertPreferenceMatchesPersisted(preference, {
    preference_id: "pref-ready",
    preference_init_point: "https://pay.example/ready",
    preference_creation_state: "ready",
    preference_creation_started_at: null,
  }));
  assert.throws(() => assertPreferenceMatchesPersisted(preference, {
    preference_id: "other",
    preference_init_point: "https://pay.example/ready",
    preference_creation_state: "ready",
    preference_creation_started_at: null,
  }), /mercadopago_preference_conflict/);
});

test("migration contains deterministic bridge-state backfill", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../supabase/migrations/20260803120000_checkout_idempotency_contract.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /when preference_id is not null and preference_init_point is not null then 'ready'/);
  assert.match(migration, /when preference_id is not null then 'ambiguous'/);
  assert.match(migration, /else 'not_started'/);
});
