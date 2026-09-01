import { createHash } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutFingerprintInput = {
  empresaId: unknown;
  direccionEnvioId: unknown;
  items: unknown;
};

function normalizeIdentifier(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function normalizeQuantity(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value ?? null;
}

function normalizeItem(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return { producto_id: null, variante_id: null, cantidad: null };
  }

  const item = value as Record<string, unknown>;
  return {
    producto_id: normalizeIdentifier(item.producto_id),
    variante_id: normalizeIdentifier(item.variante_id),
    cantidad: normalizeQuantity(item.cantidad),
  };
}

export function parseIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function createCheckoutRequestFingerprint(
  input: CheckoutFingerprintInput,
): string {
  const items = Array.isArray(input.items)
    ? input.items
        .map(normalizeItem)
        .sort((left, right) => {
          const leftValue = JSON.stringify(left);
          const rightValue = JSON.stringify(right);
          return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        })
    : input.items;

  const canonical = JSON.stringify({
    version: 1,
    empresa_id: normalizeIdentifier(input.empresaId),
    direccion_envio_id: normalizeIdentifier(input.direccionEnvioId),
    items,
  });

  return createHash("sha256").update(canonical).digest("hex");
}
