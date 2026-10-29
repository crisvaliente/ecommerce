import type { IncomingHttpHeaders } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeStorefrontHost,
  resolveStorefrontTenant,
  type DirectHostRequest,
  type TenantDomainLookup,
} from "./storefrontTenant.ts";

export type RequestStore = { empresaId: string; hostname: string };

export type RequestStoreResolution =
  | { ok: true; store: RequestStore }
  | { ok: false; status: 404; error: "tienda_no_encontrada" }
  | { ok: false; status: 503; error: "tienda_no_disponible"; hostname: string };

export type StoreOriginValidation =
  | { ok: true; origin: string | null }
  | { ok: false; reason: "missing_origin" | "untrusted_origin"; origin: string | null };

export function createStoreDomainLookup(client: Pick<SupabaseClient, "from">): TenantDomainLookup {
  return async (hostname) => {
    const { data, error } = await client
      .from("empresa_dominio")
      .select("empresa_id")
      .eq("hostname", hostname)
      .maybeSingle<{ empresa_id: string }>();
    return { data, error };
  };
}

// The store of an API request comes only from its direct Host header, with the
// same rules as the storefront (no forwarded headers, no client-sent tenant).
export async function resolveRequestStore(
  request: DirectHostRequest,
  findByHostname: TenantDomainLookup,
): Promise<RequestStoreResolution> {
  const resolution = await resolveStorefrontTenant(request, findByHostname);
  if (resolution.ok === false) {
    if (resolution.reason === "lookup_failed") {
      return { ok: false, status: 503, error: "tienda_no_disponible", hostname: resolution.hostname };
    }
    return { ok: false, status: 404, error: "tienda_no_encontrada" };
  }
  return { ok: true, store: resolution.tenant };
}

function firstHeader(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}

// Trusts a browser origin only when it is the store resolved from the same
// request, so one store's pages can never write through another store's domain.
export function validateStoreOrigin(
  request: { headers: IncomingHttpHeaders },
  storeHostname: string,
  options: { allowWithoutOrigin: boolean },
): StoreOriginValidation {
  const rawOrigin = firstHeader(request.headers.origin) ?? firstHeader(request.headers.referer);
  if (!rawOrigin) {
    return options.allowWithoutOrigin
      ? { ok: true, origin: null }
      : { ok: false, reason: "missing_origin", origin: null };
  }

  const untrusted = { ok: false, reason: "untrusted_origin", origin: rawOrigin } as const;
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    return untrusted;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return untrusted;

  const normalized = normalizeStorefrontHost(url.host);
  if (!normalized.ok || normalized.hostname !== storeHostname) return untrusted;
  return { ok: true, origin: url.origin };
}

export function storeOriginUrl(
  validation: Extract<StoreOriginValidation, { ok: true }>,
  storeHostname: string,
): string {
  return validation.origin ?? `https://${storeHostname}`;
}
