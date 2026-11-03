import assert from "node:assert/strict";
import test from "node:test";

import {
  CredentialSealError,
  generateCredentialKeyPair,
  openCredential,
  sealCredential,
} from "../src/lib/mercadoPagoCredentials.ts";

const EMPRESA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_EMPRESA_ID = "22222222-2222-4222-8222-222222222222";
const FIELD = "access_token";
const KEY_VERSION = 1;
const SEALED_FORMAT = /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

function keyPair() {
  return generateCredentialKeyPair();
}

function seal(overrides = {}) {
  const pair = keyPair();
  return {
    pair,
    sealed: sealCredential({
      publicKeyPem: pair.publicKeyPem,
      plaintext: "super-secret-token",
      empresaId: EMPRESA_ID,
      field: FIELD,
      keyVersion: KEY_VERSION,
      ...overrides,
    }),
  };
}

function open(sealed, pair, overrides = {}) {
  return openCredential({
    privateKeyPem: pair.privateKeyPem,
    sealed,
    empresaId: EMPRESA_ID,
    field: FIELD,
    keyVersion: KEY_VERSION,
    ...overrides,
  });
}

function assertSealError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof CredentialSealError, "must throw CredentialSealError");
    assert.equal(error.code, code);
    assert.ok(
      !/super-secret-token/.test(String(error.message)) && !/BEGIN (PUBLIC|PRIVATE) KEY/.test(String(error.message)),
      "error message must never contain plaintext or key material",
    );
    return true;
  });
}

test("generateCredentialKeyPair returns a usable X25519 PEM pair", () => {
  const { publicKeyPem, privateKeyPem } = keyPair();
  assert.match(publicKeyPem, /BEGIN PUBLIC KEY/);
  assert.match(privateKeyPem, /BEGIN PRIVATE KEY/);
});

test("round trip recovers the exact plaintext for both fields", () => {
  for (const field of ["access_token", "webhook_secret"]) {
    const pair = keyPair();
    const plaintext = `${field}-plaintext-value`;
    const sealed = sealCredential({
      publicKeyPem: pair.publicKeyPem, plaintext, empresaId: EMPRESA_ID, field, keyVersion: KEY_VERSION,
    });
    assert.match(sealed, SEALED_FORMAT);
    const opened = openCredential({
      privateKeyPem: pair.privateKeyPem, sealed, empresaId: EMPRESA_ID, field, keyVersion: KEY_VERSION,
    });
    assert.equal(opened, plaintext);
  }
});

test("two seals of the same plaintext produce different ciphertexts", () => {
  const pair = keyPair();
  const first = sealCredential({ publicKeyPem: pair.publicKeyPem, plaintext: "same-value", empresaId: EMPRESA_ID, field: FIELD, keyVersion: KEY_VERSION });
  const second = sealCredential({ publicKeyPem: pair.publicKeyPem, plaintext: "same-value", empresaId: EMPRESA_ID, field: FIELD, keyVersion: KEY_VERSION });
  assert.notEqual(first, second);
});

test("a tampered ephemeral key, IV, ciphertext or tag fails to decrypt", () => {
  const { pair, sealed } = seal();
  const [prefix, ephemeral, iv, ciphertext, tag] = sealed.split(":");
  const flipFirstByte = (part) => {
    const buffer = Buffer.from(part, "base64url");
    buffer[0] ^= 0xff;
    return buffer.toString("base64url");
  };
  const variants = [
    [prefix, flipFirstByte(ephemeral), iv, ciphertext, tag].join(":"),
    [prefix, ephemeral, flipFirstByte(iv), ciphertext, tag].join(":"),
    [prefix, ephemeral, iv, flipFirstByte(ciphertext), tag].join(":"),
    [prefix, ephemeral, iv, ciphertext, flipFirstByte(tag)].join(":"),
  ];
  for (const tampered of variants) {
    assertSealError(() => open(tampered, pair), "decryption_failed");
  }
});

test("a mismatched empresaId, field or keyVersion (associated data) fails to decrypt", () => {
  const { pair, sealed } = seal();
  assertSealError(() => open(sealed, pair, { empresaId: OTHER_EMPRESA_ID }), "decryption_failed");
  assertSealError(() => open(sealed, pair, { field: "webhook_secret" }), "decryption_failed");
  assertSealError(() => open(sealed, pair, { keyVersion: 2 }), "decryption_failed");
});

test("the wrong private key fails to decrypt", () => {
  const { sealed } = seal();
  const otherPair = keyPair();
  assertSealError(() => open(sealed, otherPair), "decryption_failed");
});

test("malformed sealed strings are rejected as invalid_format", () => {
  const { pair, sealed } = seal();
  const [prefix, ephemeral, iv, ciphertext, tag] = sealed.split(":");
  const malformed = [
    `v2:${ephemeral}:${iv}:${ciphertext}:${tag}`,
    `${ephemeral}:${iv}:${ciphertext}:${tag}`,
    `${prefix}:${ephemeral}:${iv}:${ciphertext}`,
    `${prefix}:${ephemeral}:${iv}:${ciphertext}:${tag}:extra`,
    `${prefix}:not-base64url!:${iv}:${ciphertext}:${tag}`,
    `${prefix}:${ephemeral}:${Buffer.from("short").toString("base64url")}:${ciphertext}:${tag}`,
    `${prefix}:${ephemeral}:${iv}:${ciphertext}:${Buffer.from("short").toString("base64url")}`,
  ];
  for (const value of malformed) {
    assertSealError(() => open(value, pair), "invalid_format");
  }
});

test("invalid inputs to sealCredential are rejected as invalid_input", () => {
  const pair = keyPair();
  const base = { publicKeyPem: pair.publicKeyPem, plaintext: "x", empresaId: EMPRESA_ID, field: FIELD, keyVersion: KEY_VERSION };
  assertSealError(() => sealCredential({ ...base, empresaId: "not-a-uuid" }), "invalid_input");
  assertSealError(() => sealCredential({ ...base, field: "password" }), "invalid_input");
  for (const keyVersion of [0, -1, 1.5, "1"]) {
    assertSealError(() => sealCredential({ ...base, keyVersion }), "invalid_input");
  }
  assertSealError(() => sealCredential({ ...base, plaintext: "" }), "invalid_input");
  assertSealError(() => sealCredential({ ...base, plaintext: "a".repeat(4097) }), "invalid_input");
  assert.doesNotThrow(() => sealCredential({ ...base, plaintext: "a".repeat(4096) }));
});

test("invalid inputs to openCredential are rejected as invalid_input", () => {
  const { pair, sealed } = seal();
  assertSealError(() => open(sealed, pair, { empresaId: "not-a-uuid" }), "invalid_input");
  assertSealError(() => open(sealed, pair, { field: "password" }), "invalid_input");
  for (const keyVersion of [0, -1, 1.5, "1"]) {
    assertSealError(() => open(sealed, pair, { keyVersion }), "invalid_input");
  }
});

test("error code and message never contain the plaintext, the sealed value or PEM text", () => {
  const { pair, sealed } = seal({ plaintext: "unique-secret-marker-xyz" });
  try {
    open(sealed, keyPair());
    assert.fail("expected decryption_failed");
  } catch (error) {
    const serialized = `${error.code}|${error.message}`;
    assert.ok(!serialized.includes("unique-secret-marker-xyz"));
    assert.ok(!serialized.includes(sealed));
    assert.ok(!serialized.includes("BEGIN"));
    assert.ok(!serialized.includes(pair.privateKeyPem));
    assert.ok(!serialized.includes(pair.publicKeyPem));
  }
});
