export const CHECKOUT_MARKER_VERSION = 1 as const;
export const CHECKOUT_MARKER_STORAGE_KEY = `ecommerce.checkout.v${CHECKOUT_MARKER_VERSION}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CheckoutCartLine = {
  productoId: string;
  varianteId: string | null;
  quantity: number;
};

export type CheckoutCart = {
  empresaId: string | null;
  items: CheckoutCartLine[];
};

export type CheckoutRequestItem = {
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
};

export type CheckoutRequest = {
  empresa_id: string;
  direccion_envio_id: string;
  items: CheckoutRequestItem[];
};

export type CheckoutMarker = {
  version: typeof CHECKOUT_MARKER_VERSION;
  userId: string;
  idempotencyKey: string;
  cartMarker: string;
  request: CheckoutRequest;
  pedidoId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function toCanonicalItems(items: CheckoutCartLine[]): CheckoutRequestItem[] {
  return items
    .map((item) => ({
      producto_id: item.productoId.trim().toLowerCase(),
      variante_id: item.varianteId?.trim().toLowerCase() || null,
      cantidad: item.quantity,
    }))
    .sort((left, right) => {
      const leftKey = JSON.stringify(left);
      const rightKey = JSON.stringify(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

export function createCartMarker(cart: CheckoutCart): string {
  return JSON.stringify({
    version: 1,
    empresa_id: cart.empresaId?.trim().toLowerCase() || null,
    items: toCanonicalItems(cart.items),
  });
}

function isCheckoutRequest(value: unknown): value is CheckoutRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<CheckoutRequest>;
  if (
    !isNonEmptyString(request.empresa_id) ||
    !isNonEmptyString(request.direccion_envio_id) ||
    !Array.isArray(request.items) ||
    request.items.length === 0
  ) {
    return false;
  }

  return request.items.every((item) =>
    Boolean(
      item &&
      typeof item === "object" &&
      isNonEmptyString(item.producto_id) &&
      (item.variante_id === null || isNonEmptyString(item.variante_id)) &&
      Number.isInteger(item.cantidad) &&
      item.cantidad > 0,
    ),
  );
}

function parseCheckoutMarker(value: string): CheckoutMarker | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const marker = parsed as Partial<CheckoutMarker>;
  if (
    marker.version !== CHECKOUT_MARKER_VERSION ||
    !isNonEmptyString(marker.userId) ||
    !isUuid(marker.idempotencyKey) ||
    !isNonEmptyString(marker.cartMarker) ||
    !isCheckoutRequest(marker.request) ||
    (marker.pedidoId !== null && !isUuid(marker.pedidoId)) ||
    !isNonEmptyString(marker.createdAt) ||
    !isNonEmptyString(marker.updatedAt)
  ) {
    return null;
  }

  return marker as CheckoutMarker;
}

export function readCheckoutMarker(storage: StorageLike): CheckoutMarker | null {
  const stored = storage.getItem(CHECKOUT_MARKER_STORAGE_KEY);
  if (stored === null) return null;
  const marker = parseCheckoutMarker(stored);
  if (!marker) storage.removeItem(CHECKOUT_MARKER_STORAGE_KEY);
  return marker;
}

function writeCheckoutMarker(storage: StorageLike, marker: CheckoutMarker): CheckoutMarker {
  storage.setItem(CHECKOUT_MARKER_STORAGE_KEY, JSON.stringify(marker));
  return marker;
}

export function getCheckoutMarkerForCart(
  storage: StorageLike,
  userId: string,
  cart: CheckoutCart,
): CheckoutMarker | null {
  const marker = readCheckoutMarker(storage);
  if (!marker) return null;
  return marker.userId === userId && marker.cartMarker === createCartMarker(cart)
    ? marker
    : null;
}

export function ensureCheckoutMarker(params: {
  storage: StorageLike;
  userId: string;
  cart: CheckoutCart;
  direccionEnvioId: string;
  createUuid?: () => string;
  now?: () => string;
}): CheckoutMarker {
  if (!params.cart.empresaId || params.cart.items.length === 0) {
    throw new Error("checkout_cart_invalid");
  }

  const cartMarker = createCartMarker(params.cart);
  const existing = readCheckoutMarker(params.storage);
  if (
    existing?.userId === params.userId &&
    existing.cartMarker === cartMarker &&
    existing.request.direccion_envio_id === params.direccionEnvioId
  ) {
    return existing;
  }

  const idempotencyKey = (params.createUuid ?? (() => crypto.randomUUID()))();
  if (!isUuid(idempotencyKey)) throw new Error("checkout_idempotency_key_invalid");
  const timestamp = (params.now ?? (() => new Date().toISOString()))();
  const marker: CheckoutMarker = {
    version: CHECKOUT_MARKER_VERSION,
    userId: params.userId,
    idempotencyKey: idempotencyKey.toLowerCase(),
    cartMarker,
    request: {
      empresa_id: params.cart.empresaId,
      direccion_envio_id: params.direccionEnvioId,
      items: toCanonicalItems(params.cart.items),
    },
    pedidoId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return writeCheckoutMarker(params.storage, marker);
}

export function persistCheckoutPedidoId(
  storage: StorageLike,
  expected: CheckoutMarker,
  pedidoId: string,
): CheckoutMarker {
  if (!isUuid(pedidoId)) throw new Error("checkout_pedido_id_invalid");
  const current = readCheckoutMarker(storage);
  if (
    !current ||
    current.userId !== expected.userId ||
    current.idempotencyKey !== expected.idempotencyKey ||
    current.cartMarker !== expected.cartMarker
  ) {
    throw new Error("checkout_marker_changed");
  }
  if (current.pedidoId && current.pedidoId !== pedidoId) {
    throw new Error("checkout_pedido_conflict");
  }

  return writeCheckoutMarker(storage, {
    ...current,
    pedidoId,
    updatedAt: new Date().toISOString(),
  });
}

export function removeCheckoutMarkerIfMatches(
  storage: StorageLike,
  expected: CheckoutMarker,
  pedidoId: string,
  userId: string,
): boolean {
  const current = readCheckoutMarker(storage);
  if (
    !current ||
    current.userId !== userId ||
    current.userId !== expected.userId ||
    current.pedidoId !== pedidoId ||
    current.idempotencyKey !== expected.idempotencyKey ||
    current.cartMarker !== expected.cartMarker
  ) {
    return false;
  }
  storage.removeItem(CHECKOUT_MARKER_STORAGE_KEY);
  return true;
}

export function removeCheckoutMarker(storage: StorageLike): void {
  storage.removeItem(CHECKOUT_MARKER_STORAGE_KEY);
}

export function isHttpsInitPoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function shouldPollPedido(estado: string | null, attempts: number, maxAttempts: number): boolean {
  return estado === "pendiente_pago" && attempts < maxAttempts;
}

export function getSafeAuthReturn(value: unknown): "/coleccion" {
  return value === "/coleccion" ? "/coleccion" : "/coleccion";
}

export function createSingleFlight<Args extends unknown[], Result>(
  operation: (...args: Args) => Promise<Result> | Result,
): (...args: Args) => Promise<Result> {
  let active: Promise<Result> | null = null;
  return (...args: Args): Promise<Result> => {
    if (active) return active;
    try {
      active = Promise.resolve(operation(...args));
    } catch (error) {
      active = Promise.reject(error);
    }
    active = active.finally(() => {
      active = null;
    });
    return active;
  };
}
