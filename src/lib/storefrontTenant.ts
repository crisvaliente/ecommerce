import type { IncomingMessage } from "node:http";

export type DirectHostRequest = Pick<IncomingMessage, "headers" | "rawHeaders">;

export type DirectHostExtraction =
  | { ok: true; rawHost: string }
  | { ok: false; reason: "missing_host" | "multiple_host_values" | "invalid_host_value" };

export type HostNormalizationResult =
  | { ok: true; hostname: string }
  | { ok: false; reason: "invalid_host" };

export type StorefrontTenantResolution =
  | { ok: true; tenant: { empresaId: string; hostname: string } }
  | {
      ok: false;
      reason: "invalid_host";
      detail: "missing_host" | "multiple_host_values" | "invalid_host_value" | "invalid_host";
    }
  | { ok: false; reason: "unknown_host"; hostname: string }
  | { ok: false; reason: "lookup_failed"; hostname: string };

export type TenantDomainLookup = (hostname: string) => Promise<{
  data: { empresa_id: string } | null;
  error: unknown;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function extractDirectHost(request: DirectHostRequest): DirectHostExtraction {
  const hostHeader = request.headers.host;
  const rawHosts: string[] = [];

  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === "host") {
      rawHosts.push(request.rawHeaders[index + 1] ?? "");
    }
  }

  if (hostHeader === undefined && rawHosts.length === 0) {
    return { ok: false, reason: "missing_host" };
  }
  if (rawHosts.length !== 1 || Array.isArray(hostHeader) || typeof hostHeader !== "string") {
    return { ok: false, reason: "multiple_host_values" };
  }
  if (!hostHeader || hostHeader.includes(",") || rawHosts[0] !== hostHeader) {
    return { ok: false, reason: "invalid_host_value" };
  }
  return { ok: true, rawHost: hostHeader };
}

export function normalizeStorefrontHost(rawHost: string): HostNormalizationResult {
  if (
    rawHost.length === 0 ||
    /[^\x21-\x7e]/.test(rawHost) ||
    /[,/\\?#@%\[\]]/.test(rawHost) ||
    rawHost.includes("://")
  ) {
    return { ok: false, reason: "invalid_host" };
  }

  const parts = rawHost.split(":");
  if (parts.length > 2) return { ok: false, reason: "invalid_host" };

  let hostname = parts[0];
  if (parts.length === 2) {
    const port = parts[1];
    if (!/^\d+$/.test(port)) return { ok: false, reason: "invalid_host" };
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
      return { ok: false, reason: "invalid_host" };
    }
  }

  if (hostname.endsWith("..")) return { ok: false, reason: "invalid_host" };
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  hostname = hostname.toLowerCase();

  if (
    hostname.length < 1 ||
    hostname.length > 253 ||
    hostname.split(".").some((label) => !DNS_LABEL_PATTERN.test(label))
  ) {
    return { ok: false, reason: "invalid_host" };
  }

  return { ok: true, hostname };
}

export async function resolveStorefrontTenant(
  request: DirectHostRequest,
  findByHostname: TenantDomainLookup,
): Promise<StorefrontTenantResolution> {
  const extracted = extractDirectHost(request);
  if (extracted.ok === false) {
    return { ok: false, reason: "invalid_host", detail: extracted.reason };
  }

  const normalized = normalizeStorefrontHost(extracted.rawHost);
  if (!normalized.ok) {
    return { ok: false, reason: "invalid_host", detail: "invalid_host" };
  }

  try {
    const { data, error } = await findByHostname(normalized.hostname);
    if (error || (data !== null && !UUID_PATTERN.test(data.empresa_id))) {
      return { ok: false, reason: "lookup_failed", hostname: normalized.hostname };
    }
    if (!data) return { ok: false, reason: "unknown_host", hostname: normalized.hostname };
    return {
      ok: true,
      tenant: { empresaId: data.empresa_id, hostname: normalized.hostname },
    };
  } catch {
    return { ok: false, reason: "lookup_failed", hostname: normalized.hostname };
  }
}
