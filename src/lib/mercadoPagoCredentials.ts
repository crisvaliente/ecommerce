import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Server-only module (Node crypto). Seals Mercado Pago credentials (access
// token, webhook secret) with the platform's public key so the plaintext is
// readable only where the private key lives (Vercel Production). See
// odd/tasks/mercadopago-per-store.md, "Encryption (D6-a: public-key sealing)".

export type CredentialField = "access_token" | "webhook_secret";

export type CredentialSealErrorCode = "invalid_input" | "invalid_format" | "decryption_failed";

export class CredentialSealError extends Error {
  readonly code: CredentialSealErrorCode;

  constructor(code: CredentialSealErrorCode) {
    super(code);
    this.name = "CredentialSealError";
    this.code = code;
  }
}

interface SealCredentialInput {
  publicKeyPem: string;
  plaintext: string;
  empresaId: string;
  field: CredentialField;
  keyVersion: number;
}

interface OpenCredentialInput {
  privateKeyPem: string;
  sealed: string;
  empresaId: string;
  field: CredentialField;
  keyVersion: number;
}

const FORMAT_PREFIX = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_PLAINTEXT_BYTES = 4096;
const HKDF_INFO = Buffer.from("ecommerce-platform/mercadopago-credentials/v1", "utf8");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const FIELDS: readonly CredentialField[] = ["access_token", "webhook_secret"];

function fail(code: CredentialSealErrorCode): never {
  throw new CredentialSealError(code);
}

function assertEmpresaIdFieldKeyVersion(empresaId: string, field: CredentialField, keyVersion: number): void {
  if (typeof empresaId !== "string" || !UUID_PATTERN.test(empresaId)) fail("invalid_input");
  if (!FIELDS.includes(field)) fail("invalid_input");
  if (typeof keyVersion !== "number" || !Number.isInteger(keyVersion) || keyVersion <= 0) fail("invalid_input");
}

function assertPlaintext(plaintext: string): void {
  if (typeof plaintext !== "string") fail("invalid_input");
  const byteLength = Buffer.byteLength(plaintext, "utf8");
  if (byteLength === 0 || byteLength > MAX_PLAINTEXT_BYTES) fail("invalid_input");
}

function associatedData(empresaId: string, field: CredentialField, keyVersion: number): Buffer {
  return Buffer.from(`${empresaId}|${field}|${keyVersion}`, "utf8");
}

function decodeBase64url(label: string, value: string, expectedLength?: number): Buffer {
  if (typeof value !== "string" || value.length === 0 || !BASE64URL_PATTERN.test(value)) fail("invalid_format");
  let decoded: Buffer;
  try {
    decoded = Buffer.from(value, "base64url");
  } catch {
    fail("invalid_format");
  }
  if (decoded.length === 0) fail("invalid_format");
  if (expectedLength !== undefined && decoded.length !== expectedLength) fail("invalid_format");
  return decoded;
}

function parseSealed(sealed: string): { ephemeralSpkiDer: Buffer; iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  if (typeof sealed !== "string") fail("invalid_format");
  const parts = sealed.split(":");
  if (parts.length !== 5) fail("invalid_format");
  const [prefix, ephemeral, iv, ciphertext, tag] = parts;
  if (prefix !== FORMAT_PREFIX) fail("invalid_format");
  return {
    ephemeralSpkiDer: decodeBase64url("ephemeral", ephemeral),
    iv: decodeBase64url("iv", iv, IV_LENGTH),
    ciphertext: decodeBase64url("ciphertext", ciphertext),
    tag: decodeBase64url("tag", tag, TAG_LENGTH),
  };
}

function deriveKey(sharedSecret: Buffer, ephemeralSpkiDer: Buffer, recipientSpkiDer: Buffer): Buffer {
  const salt = Buffer.concat([ephemeralSpkiDer, recipientSpkiDer]);
  return Buffer.from(hkdfSync("sha256", sharedSecret, salt, HKDF_INFO, 32));
}

export function generateCredentialKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function sealCredential({ publicKeyPem, plaintext, empresaId, field, keyVersion }: SealCredentialInput): string {
  assertEmpresaIdFieldKeyVersion(empresaId, field, keyVersion);
  assertPlaintext(plaintext);

  const recipientPublicKey = createPublicKey(publicKeyPem);
  const recipientSpkiDer = recipientPublicKey.export({ type: "spki", format: "der" });
  const ephemeral = generateKeyPairSync("x25519");
  const ephemeralSpkiDer = ephemeral.publicKey.export({ type: "spki", format: "der" });
  const sharedSecret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipientPublicKey });
  const key = deriveKey(sharedSecret, ephemeralSpkiDer, recipientSpkiDer);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(associatedData(empresaId, field, keyVersion));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT_PREFIX,
    ephemeralSpkiDer.toString("base64url"),
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(":");
}

export function openCredential({ privateKeyPem, sealed, empresaId, field, keyVersion }: OpenCredentialInput): string {
  assertEmpresaIdFieldKeyVersion(empresaId, field, keyVersion);
  const { ephemeralSpkiDer, iv, ciphertext, tag } = parseSealed(sealed);

  try {
    const privateKey = createPrivateKey(privateKeyPem);
    const recipientPublicKey = createPublicKey(privateKey);
    const recipientSpkiDer = recipientPublicKey.export({ type: "spki", format: "der" });
    const ephemeralPublicKey = createPublicKey({ key: ephemeralSpkiDer, format: "der", type: "spki" });
    const sharedSecret = diffieHellman({ privateKey, publicKey: ephemeralPublicKey });
    const key = deriveKey(sharedSecret, ephemeralSpkiDer, recipientSpkiDer);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(associatedData(empresaId, field, keyVersion));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch (error) {
    if (error instanceof CredentialSealError) throw error;
    return fail("decryption_failed");
  }
}
