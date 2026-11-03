import type { SupabaseClient } from "@supabase/supabase-js";
import { openCredential } from "./mercadoPagoCredentials.ts";

// Loads one store's sealed Mercado Pago credentials and opens the access
// token in memory for the current request only. See
// odd/tasks/mercadopago-per-store.md, "P1 — Store credentials, fail closed".

export type StoreCredentialsFailureReason = "lookup_failed" | "key_missing" | "decryption_failed";

export type StoreCredentialsResult =
  | { ok: true; accessToken: string; mpUserId: number; liveMode: boolean }
  | { ok: false; status: 409; error: "pagos_no_configurados" }
  | { ok: false; status: 503; error: "pagos_no_disponibles"; reason: StoreCredentialsFailureReason };

type EmpresaMercadoPagoRow = {
  mp_user_id: number;
  live_mode: boolean;
  access_token_enc: string;
  key_version: number;
  estado: "activo" | "inactivo";
};

const SELECT_COLUMNS = "mp_user_id, live_mode, access_token_enc, key_version, estado";

function unavailable(reason: StoreCredentialsFailureReason): StoreCredentialsResult {
  return { ok: false, status: 503, error: "pagos_no_disponibles", reason };
}

export async function loadStoreMercadoPagoCredentials(params: {
  client: SupabaseClient;
  empresaId: string;
  env: Record<string, string | undefined>;
}): Promise<StoreCredentialsResult> {
  const { client, empresaId, env } = params;

  const { data, error } = await client
    .from("empresa_mercadopago")
    .select(SELECT_COLUMNS)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) return unavailable("lookup_failed");

  const row = data as EmpresaMercadoPagoRow | null;
  if (!row || row.estado !== "activo") {
    return { ok: false, status: 409, error: "pagos_no_configurados" };
  }

  const privateKeyPem = env[`MP_CREDENTIALS_PRIVATE_KEY_V${row.key_version}`];
  if (!privateKeyPem) return unavailable("key_missing");

  try {
    const accessToken = openCredential({
      privateKeyPem,
      sealed: row.access_token_enc,
      empresaId,
      field: "access_token",
      keyVersion: row.key_version,
    });
    return { ok: true, accessToken, mpUserId: row.mp_user_id, liveMode: row.live_mode };
  } catch {
    return unavailable("decryption_failed");
  }
}
