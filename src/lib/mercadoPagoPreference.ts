export type MercadoPagoPreference = {
  id: string;
  init_point: string;
  external_reference: string;
};

export type ExpectedMercadoPagoPreference = {
  intentoPagoId: string;
  pedidoId: string;
  total: number;
  dateOfExpiration: string;
};

export type PreferenceBridgeState =
  | "not_started"
  | "creating"
  | "ready"
  | "ambiguous"
  | "failed";

export type PersistedPreferenceState = {
  preference_id: string | null;
  preference_init_point: string | null;
  preference_creation_state: PreferenceBridgeState;
  preference_creation_started_at: string | null;
};

export type PreferenceResolutionMode =
  | "claim"
  | "recover"
  | "reuse"
  | "reconcile"
  | "in_progress"
  | "failed";

export class MercadoPagoBridgeError extends Error {
  readonly ambiguous: boolean;

  constructor(message: string, ambiguous: boolean) {
    super(message);
    this.name = "MercadoPagoBridgeError";
    this.ambiguous = ambiguous;
  }
}

type ProviderPreferenceResponse = {
  id?: unknown;
  init_point?: unknown;
  sandbox_init_point?: unknown;
  external_reference?: unknown;
  expires?: unknown;
  date_of_expiration?: unknown;
  status?: unknown;
  items?: unknown;
};

type ProviderSearchResponse = {
  elements?: unknown;
  next_offset?: unknown;
  total?: unknown;
  paging?: unknown;
};

type FetchLike = typeof fetch;

type BackUrls = {
  success: string;
  failure: string;
  pending: string;
};

const SEARCH_PAGE_SIZE = 50;
const MAX_SEARCH_PAGES = 100;
const DEFAULT_CREATING_STALE_MS = 30_000;
const UNUSABLE_STATUSES = new Set(["cancelled", "canceled", "expired", "inactive"]);

function isStale(startedAt: string | null, nowMs: number, staleMs: number): boolean {
  if (!startedAt) return true;
  const timestamp = Date.parse(startedAt);
  return !Number.isFinite(timestamp) || nowMs - timestamp >= staleMs;
}

export function getPreferenceResolutionMode(
  state: PersistedPreferenceState,
  options: { nowMs?: number; staleMs?: number } = {},
): PreferenceResolutionMode {
  if (state.preference_init_point && !state.preference_id) {
    throw new MercadoPagoBridgeError("mercadopago_preference_conflict", false);
  }
  if (state.preference_id && state.preference_init_point) return "reuse";
  if (state.preference_id) return "recover";

  switch (state.preference_creation_state) {
    case "not_started":
      return "claim";
    case "creating":
      return isStale(
        state.preference_creation_started_at,
        options.nowMs ?? Date.now(),
        options.staleMs ?? DEFAULT_CREATING_STALE_MS,
      )
        ? "reconcile"
        : "in_progress";
    case "ambiguous":
      return "reconcile";
    case "failed":
      return "failed";
    case "ready":
      throw new MercadoPagoBridgeError("mercadopago_preference_conflict", false);
  }
}

export function assertPreferenceMatchesPersisted(
  preference: MercadoPagoPreference,
  persisted: PersistedPreferenceState,
): void {
  if (
    persisted.preference_creation_state !== "ready" ||
    persisted.preference_id !== preference.id ||
    persisted.preference_init_point !== preference.init_point
  ) {
    throw new MercadoPagoBridgeError("mercadopago_preference_conflict", false);
  }
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseUsableInitPoint(body: ProviderPreferenceResponse): string | null {
  const value =
    typeof body.init_point === "string"
      ? body.init_point
      : typeof body.sandbox_init_point === "string"
        ? body.sandbox_init_point
        : null;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function parseCompatiblePreference(
  body: ProviderPreferenceResponse,
  expected: ExpectedMercadoPagoPreference,
  preferenceId: string,
  nowMs = Date.now(),
): MercadoPagoPreference {
  const initPoint = parseUsableInitPoint(body);
  const externalReference =
    typeof body.external_reference === "string" ? body.external_reference : null;
  const status = typeof body.status === "string" ? body.status.toLowerCase() : null;
  const expiration =
    typeof body.date_of_expiration === "string"
      ? Date.parse(body.date_of_expiration)
      : NaN;
  const expectedExpiration = Date.parse(expected.dateOfExpiration);
  const items = Array.isArray(body.items) ? body.items : [];
  const item = items.length === 1 && items[0] && typeof items[0] === "object"
    ? (items[0] as Record<string, unknown>)
    : null;
  const amount = parsePositiveNumber(item?.unit_price);

  if (
    body.id !== preferenceId ||
    !initPoint ||
    externalReference !== expected.intentoPagoId ||
    body.expires !== true ||
    !Number.isFinite(expiration) ||
    !Number.isFinite(expectedExpiration) ||
    expiration <= nowMs ||
    Math.abs(expiration - expectedExpiration) > 1_000 ||
    (status !== null && UNUSABLE_STATUSES.has(status)) ||
    !item ||
    item.id !== expected.pedidoId ||
    item.quantity !== 1 ||
    item.currency_id !== "UYU" ||
    amount === null ||
    Math.abs(amount - expected.total) > 0.005
  ) {
    throw new MercadoPagoBridgeError("mercadopago_preference_mismatch", false);
  }

  return { id: preferenceId, init_point: initPoint, external_reference: externalReference };
}

export async function recoverMercadoPagoPreference(params: {
  fetchImpl?: FetchLike;
  accessToken: string;
  preferenceId: string;
  expected: ExpectedMercadoPagoPreference;
}): Promise<MercadoPagoPreference> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(params.preferenceId)}`,
      { headers: { Authorization: `Bearer ${params.accessToken}` } },
    );
  } catch {
    throw new MercadoPagoBridgeError("mercadopago_preference_recovery_error", false);
  }

  if (!response.ok) {
    throw new MercadoPagoBridgeError("mercadopago_preference_recovery_error", false);
  }

  const body = (await response.json().catch(() => null)) as ProviderPreferenceResponse | null;
  if (!body) throw new MercadoPagoBridgeError("mercadopago_preference_mismatch", false);
  return parseCompatiblePreference(body, params.expected, params.preferenceId);
}

export async function createMercadoPagoPreference(params: {
  fetchImpl?: FetchLike;
  accessToken: string;
  expected: ExpectedMercadoPagoPreference;
  notificationUrl: string;
  backUrls: BackUrls;
}): Promise<MercadoPagoPreference> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_reference: params.expected.intentoPagoId,
        notification_url: params.notificationUrl,
        expires: true,
        date_of_expiration: params.expected.dateOfExpiration,
        back_urls: params.backUrls,
        items: [
          {
            id: params.expected.pedidoId,
            title: `Pedido ${params.expected.pedidoId}`,
            quantity: 1,
            unit_price: params.expected.total,
            currency_id: "UYU",
          },
        ],
      }),
    });
  } catch {
    throw new MercadoPagoBridgeError("mercadopago_preference_ambiguous", true);
  }

  if (!response.ok) {
    const ambiguous = response.status >= 500 || response.status === 408 || response.status === 429;
    throw new MercadoPagoBridgeError(
      ambiguous ? "mercadopago_preference_ambiguous" : "mercadopago_preference_error",
      ambiguous,
    );
  }

  const body = (await response.json().catch(() => null)) as ProviderPreferenceResponse | null;
  const preferenceId = body && typeof body.id === "string" ? body.id : null;
  if (!preferenceId) {
    throw new MercadoPagoBridgeError("mercadopago_preference_ambiguous", true);
  }

  try {
    return await recoverMercadoPagoPreference({
      fetchImpl,
      accessToken: params.accessToken,
      preferenceId,
      expected: params.expected,
    });
  } catch {
    throw new MercadoPagoBridgeError("mercadopago_preference_ambiguous", true);
  }
}

function parsePagingNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function searchMercadoPagoPreferenceIds(params: {
  fetchImpl?: FetchLike;
  accessToken: string;
  externalReference: string;
}): Promise<string[]> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const ids = new Set<string>();
  let offset = 0;

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const url = new URL("https://api.mercadopago.com/checkout/preferences/search");
    url.searchParams.set("external_reference", params.externalReference);
    url.searchParams.set("limit", String(SEARCH_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
    } catch {
      throw new MercadoPagoBridgeError("mercadopago_preference_search_error", false);
    }
    if (!response.ok) {
      throw new MercadoPagoBridgeError("mercadopago_preference_search_error", false);
    }

    const body = (await response.json().catch(() => null)) as ProviderSearchResponse | null;
    if (!body || !Array.isArray(body.elements)) {
      throw new MercadoPagoBridgeError("mercadopago_preference_search_inconclusive", false);
    }

    for (const element of body.elements) {
      if (!element || typeof element !== "object") {
        throw new MercadoPagoBridgeError("mercadopago_preference_search_inconclusive", false);
      }
      const record = element as Record<string, unknown>;
      if (record.external_reference !== params.externalReference || typeof record.id !== "string") {
        throw new MercadoPagoBridgeError("mercadopago_preference_search_inconclusive", false);
      }
      ids.add(record.id);
    }

    const paging = body.paging && typeof body.paging === "object"
      ? (body.paging as Record<string, unknown>)
      : null;
    const total = parsePagingNumber(body.total) ?? parsePagingNumber(paging?.total);
    const explicitNext = parsePagingNumber(body.next_offset);
    const consumed = body.elements.length;

    if (explicitNext !== null && explicitNext > offset) {
      offset = explicitNext;
    } else {
      offset += consumed;
    }

    if (total !== null) {
      if (offset >= total) return [...ids];
      if (consumed === 0) {
        throw new MercadoPagoBridgeError("mercadopago_preference_search_inconclusive", false);
      }
      continue;
    }

    if (consumed < SEARCH_PAGE_SIZE) return [...ids];
  }

  throw new MercadoPagoBridgeError("mercadopago_preference_search_inconclusive", false);
}

export async function reconcileMercadoPagoPreference(params: {
  fetchImpl?: FetchLike;
  accessToken: string;
  expected: ExpectedMercadoPagoPreference;
}): Promise<MercadoPagoPreference> {
  const ids = await searchMercadoPagoPreferenceIds({
    fetchImpl: params.fetchImpl,
    accessToken: params.accessToken,
    externalReference: params.expected.intentoPagoId,
  });

  if (ids.length === 0) {
    throw new MercadoPagoBridgeError("mercadopago_preference_ambiguous", false);
  }
  if (ids.length !== 1) {
    throw new MercadoPagoBridgeError("mercadopago_preference_conflict", false);
  }

  return recoverMercadoPagoPreference({
    fetchImpl: params.fetchImpl,
    accessToken: params.accessToken,
    preferenceId: ids[0],
    expected: params.expected,
  });
}
