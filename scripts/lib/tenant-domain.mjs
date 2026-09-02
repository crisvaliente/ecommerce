import { parseAppBaseUrl } from "../../src/config/instance.ts";
import { normalizeStorefrontHost } from "../../src/lib/storefrontTenant.ts";

export function resolveCanonicalHostname(rawAppBaseUrl) {
  if (typeof rawAppBaseUrl !== "string" || /[^\x00-\x7f]/.test(rawAppBaseUrl)) {
    throw new Error("APP_BASE_URL must contain ASCII characters only.");
  }
  const appBaseUrl = parseAppBaseUrl(rawAppBaseUrl);
  const normalized = normalizeStorefrontHost(new URL(appBaseUrl).host);
  if (!normalized.ok) {
    throw new Error("APP_BASE_URL has a hostname outside the storefront Host policy.");
  }
  return normalized.hostname;
}

export async function ensureTenantDomain(supabase, hostname, empresaId) {
  const { error: insertError } = await supabase
    .from("empresa_dominio")
    .insert({ hostname, empresa_id: empresaId });

  if (!insertError) return { hostname, created: true };
  if (insertError.code !== "23505") throw insertError;

  const { data, error: readError } = await supabase
    .from("empresa_dominio")
    .select("empresa_id")
    .eq("hostname", hostname)
    .single();
  if (readError) throw readError;
  if (data?.empresa_id !== empresaId) {
    throw new Error(`Hostname ${hostname} already belongs to another company.`);
  }
  return { hostname, created: false };
}
