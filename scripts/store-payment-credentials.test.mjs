import assert from "node:assert/strict";
import test from "node:test";

import { generateCredentialKeyPair, sealCredential } from "../src/lib/mercadoPagoCredentials.ts";
import { loadStoreMercadoPagoCredentials } from "../src/lib/storePaymentCredentials.ts";

const EMPRESA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_EMPRESA_ID = "22222222-2222-4222-8222-222222222222";
const SELECT_COLUMNS = "mp_user_id, live_mode, access_token_enc, key_version, estado";

function fakeClient({ row = null, error = null } = {}) {
  const calls = { from: [], select: [], eq: [] };
  const client = {
    from(table) {
      calls.from.push(table);
      return {
        select(columns) {
          calls.select.push(columns);
          return this;
        },
        eq(column, value) {
          calls.eq.push({ column, value });
          return this;
        },
        async maybeSingle() {
          return { data: row, error };
        },
      };
    },
  };
  return { client, calls };
}

function sealedToken({ pair, empresaId = EMPRESA_ID, keyVersion = 1, plaintext = "ACCESS-TOKEN-123" }) {
  return sealCredential({
    publicKeyPem: pair.publicKeyPem,
    plaintext,
    empresaId,
    field: "access_token",
    keyVersion,
  });
}

test("returns the token, mp_user_id and live_mode for an active row", async () => {
  const pair = generateCredentialKeyPair();
  const accessTokenEnc = sealedToken({ pair });
  const { client, calls } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: accessTokenEnc,
      key_version: 1,
      estado: "activo",
    },
  });

  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem },
  });

  assert.deepEqual(result, {
    ok: true,
    accessToken: "ACCESS-TOKEN-123",
    mpUserId: 555,
    liveMode: true,
  });
  assert.deepEqual(calls.from, ["empresa_mercadopago"]);
  assert.deepEqual(calls.select, [SELECT_COLUMNS]);
  assert.deepEqual(calls.eq, [{ column: "empresa_id", value: EMPRESA_ID }]);
});

test("no row answers 409 pagos_no_configurados", async () => {
  const { client } = fakeClient({ row: null });
  const result = await loadStoreMercadoPagoCredentials({ client, empresaId: EMPRESA_ID, env: {} });
  assert.deepEqual(result, { ok: false, status: 409, error: "pagos_no_configurados" });
});

test("an inactive row answers 409 pagos_no_configurados", async () => {
  const pair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: sealedToken({ pair }),
      key_version: 1,
      estado: "inactivo",
    },
  });
  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem },
  });
  assert.deepEqual(result, { ok: false, status: 409, error: "pagos_no_configurados" });
});

test("a read error answers 503 pagos_no_disponibles lookup_failed", async () => {
  const { client } = fakeClient({ error: { message: "connection reset" } });
  const result = await loadStoreMercadoPagoCredentials({ client, empresaId: EMPRESA_ID, env: {} });
  assert.deepEqual(result, { ok: false, status: 503, error: "pagos_no_disponibles", reason: "lookup_failed" });
});

test("a missing private key for the row's version answers 503 key_missing", async () => {
  const pair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: sealedToken({ pair, keyVersion: 2 }),
      key_version: 2,
      estado: "activo",
    },
  });
  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem },
  });
  assert.deepEqual(result, { ok: false, status: 503, error: "pagos_no_disponibles", reason: "key_missing" });
});

test("the wrong key answers 503 decryption_failed", async () => {
  const pair = generateCredentialKeyPair();
  const wrongPair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: sealedToken({ pair }),
      key_version: 1,
      estado: "activo",
    },
  });
  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: wrongPair.privateKeyPem },
  });
  assert.deepEqual(result, { ok: false, status: 503, error: "pagos_no_disponibles", reason: "decryption_failed" });
});

test("ciphertext sealed for another store (AAD mismatch) answers 503 decryption_failed", async () => {
  const pair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: sealedToken({ pair, empresaId: OTHER_EMPRESA_ID }),
      key_version: 1,
      estado: "activo",
    },
  });
  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem },
  });
  assert.deepEqual(result, { ok: false, status: 503, error: "pagos_no_disponibles", reason: "decryption_failed" });
});

test("the select asks only for the five documented columns filtered by empresa_id", async () => {
  const { client, calls } = fakeClient({ row: null });
  await loadStoreMercadoPagoCredentials({ client, empresaId: EMPRESA_ID, env: {} });
  assert.deepEqual(calls.select, [SELECT_COLUMNS]);
  assert.deepEqual(calls.eq, [{ column: "empresa_id", value: EMPRESA_ID }]);
});

test("the returned object never contains the ciphertext or the key", async () => {
  const pair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: false,
      access_token_enc: sealedToken({ pair }),
      key_version: 1,
      estado: "activo",
    },
  });
  const result = await loadStoreMercadoPagoCredentials({
    client,
    empresaId: EMPRESA_ID,
    env: { MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem },
  });
  assert.ok(result.ok);
  assert.deepEqual(Object.keys(result).sort(), ["accessToken", "liveMode", "mpUserId", "ok"]);
  assert.equal(JSON.stringify(result).includes(pair.privateKeyPem), false);
});

test("never reads MERCADOPAGO_ACCESS_TOKEN", async () => {
  const pair = generateCredentialKeyPair();
  const { client } = fakeClient({
    row: {
      mp_user_id: 555,
      live_mode: true,
      access_token_enc: sealedToken({ pair }),
      key_version: 1,
      estado: "activo",
    },
  });
  const env = {
    MP_CREDENTIALS_PRIVATE_KEY_V1: pair.privateKeyPem,
    MERCADOPAGO_ACCESS_TOKEN: "env-token-should-never-be-used",
  };
  const result = await loadStoreMercadoPagoCredentials({ client, empresaId: EMPRESA_ID, env });
  assert.ok(result.ok);
  assert.equal(result.accessToken, "ACCESS-TOKEN-123");
});
