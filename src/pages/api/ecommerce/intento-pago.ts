import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  hasBearerAuthorization,
  hasSessionAccessCookie,
  isOriginValidationFailure,
  validateTrustedOrigin,
} from "../../../lib/apiSecurity";
import {
  assertPreferenceMatchesPersisted,
  createMercadoPagoPreference,
  getPreferenceResolutionMode,
  MercadoPagoBridgeError,
  reconcileMercadoPagoPreference,
  recoverMercadoPagoPreference,
  type ExpectedMercadoPagoPreference,
  type MercadoPagoPreference,
  type PreferenceBridgeState,
} from "../../../lib/mercadoPagoPreference";

type RpcRow = {
  ok: boolean;
  codigo_resultado: string;
  intento_pago_id: string | null;
  pedido_id: string | null;
  estado_intento: string | null;
};

type PedidoRow = {
  id: string;
  total: number | string | null;
  expira_en: string | null;
};

type IntentoPreferenceRow = {
  id: string;
  preference_id: string | null;
  preference_init_point: string | null;
  preference_creation_state: PreferenceBridgeState;
  preference_creation_started_at: string | null;
  preference_last_error: string | null;
};

type ApiOk = {
  intento_pago: {
    id: string;
    pedido_id: string;
    estado: string;
    preference_id: string;
    init_point: string;
  };
};

type ApiErr = {
  error: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const APP_BASE_URL = process.env.APP_BASE_URL;

function getAccessToken(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;

  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }

  const cookie = req.headers.cookie;
  if (cookie && typeof cookie === "string") {
    const m = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }

  return null;
}

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function mapRpcErrorToStatus(code: string): number {
  switch (code) {
    case "pedido_no_encontrado":
      return 404;
    case "pedido_expirado":
    case "pedido_bloqueado":
    case "pedido_no_pagable":
      return 409;
    default:
      return 500;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildCheckoutResultUrl(params: {
  baseUrl: string;
  pedidoId: string;
  status: "success" | "failure" | "pending";
}): string {
  const url = new URL(`${normalizeBaseUrl(params.baseUrl)}/checkout/resultado`);
  url.searchParams.set("pedido_id", params.pedidoId);
  url.searchParams.set("status", params.status);
  return url.toString();
}

const PREFERENCE_SELECT =
  "id, preference_id, preference_init_point, preference_creation_state, preference_creation_started_at, preference_last_error";

function preferenceErrorCode(error: unknown): string {
  return error instanceof MercadoPagoBridgeError
    ? error.message.slice(0, 100)
    : "mercadopago_preference_error";
}

function toAmount(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: "api:ecommerce:intento-pago:create",
    limit: 10,
    windowMs: 60_000,
  });

  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  const originValidation = validateTrustedOrigin(req, {
    allowWithoutOrigin: hasBearerAuthorization(req) || !hasSessionAccessCookie(req),
  });

  if (isOriginValidationFailure(originValidation)) {
    return res.status(403).json({ error: originValidation.reason });
  }

  if (
    !SUPABASE_URL ||
    !ANON_KEY ||
    !SERVICE_ROLE ||
    !MP_ACCESS_TOKEN ||
    !APP_BASE_URL
  ) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  const pedidoId = req.body?.pedido_id;

  if (!isValidUuid(pedidoId)) {
    return res.status(400).json({ error: "pedido_id_invalido" });
  }

  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: usuarioRow, error: usuarioError } = await serviceClient
    .from("usuario")
    .select("id")
    .eq("supabase_uid", authData.user.id)
    .single();

  if (usuarioError || !usuarioRow?.id) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { data: rpcData, error: rpcError } = await serviceClient.rpc(
    "crear_intento_pago",
    {
      p_usuario_id: usuarioRow.id,
      p_pedido_id: pedidoId,
      p_canal_pago: "mercadopago",
    }
  );

  if (rpcError) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  const row = Array.isArray(rpcData)
    ? (rpcData[0] as RpcRow | undefined)
    : (rpcData as RpcRow | null);

  console.log("[intento-pago] rpc row", row);

  if (!row) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  if (!(row.ok && (row.codigo_resultado === "creado" || row.codigo_resultado === "reutilizado"))) {
    const status = mapRpcErrorToStatus(row.codigo_resultado);
    const errorCode =
      status === 500 ? "unexpected_error" : row.codigo_resultado || "unexpected_error";

    return res.status(status).json({ error: errorCode });
  }

  if (!row.intento_pago_id || !row.pedido_id || !row.estado_intento) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  const { data: pedidoRow, error: pedidoError } = await serviceClient
    .from("pedido")
    .select("id, total, expira_en")
    .eq("id", row.pedido_id)
    .single();

  console.log("[intento-pago] pedidoRow", {
    pedidoError,
    pedidoRow,
  });

  const pedido = pedidoRow as PedidoRow | null;
  const total = toAmount(pedido?.total ?? null);
  const expiraEn = pedido?.expira_en ?? null;

  if (pedidoError || !pedido?.id || total === null || !expiraEn) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  const notificationUrl = `${normalizeBaseUrl(APP_BASE_URL)}/api/webhooks/mercadopago`;
  const backUrls = {
    success: buildCheckoutResultUrl({
      baseUrl: APP_BASE_URL,
      pedidoId: row.pedido_id,
      status: "success",
    }),
    failure: buildCheckoutResultUrl({
      baseUrl: APP_BASE_URL,
      pedidoId: row.pedido_id,
      status: "failure",
    }),
    pending: buildCheckoutResultUrl({
      baseUrl: APP_BASE_URL,
      pedidoId: row.pedido_id,
      status: "pending",
    }),
  };

  const expectedPreference: ExpectedMercadoPagoPreference = {
    intentoPagoId: row.intento_pago_id,
    pedidoId: row.pedido_id,
    total,
    dateOfExpiration: expiraEn,
  };

  const readPreferenceState = async (): Promise<IntentoPreferenceRow | null> => {
    const { data, error } = await serviceClient
      .from("intento_pago")
      .select(PREFERENCE_SELECT)
      .eq("id", row.intento_pago_id)
      .single();
    return error || !data?.id ? null : (data as IntentoPreferenceRow);
  };

  const markBridgeState = async (
    state: PreferenceBridgeState,
    allowedStates: PreferenceBridgeState[],
    errorCode: string | null,
  ): Promise<void> => {
    const { error } = await serviceClient
      .from("intento_pago")
      .update({
        preference_creation_state: state,
        preference_last_error: errorCode,
      })
      .eq("id", row.intento_pago_id)
      .in("preference_creation_state", allowedStates);
    if (error) {
      console.error("[intento-pago] bridge state update failed", {
        intento_pago_id: row.intento_pago_id,
        target_state: state,
        error,
      });
    }
  };

  const persistReadyPreference = async (
    preference: MercadoPagoPreference,
    mode: "new" | "recover",
  ): Promise<IntentoPreferenceRow> => {
    const query = mode === "recover"
      ? serviceClient
          .from("intento_pago")
          .update({
            preference_init_point: preference.init_point,
            preference_creation_state: "ready",
            preference_last_error: null,
          })
          .eq("id", row.intento_pago_id)
          .eq("preference_id", preference.id)
          .is("preference_init_point", null)
      : serviceClient
          .from("intento_pago")
          .update({
            preference_id: preference.id,
            preference_init_point: preference.init_point,
            preference_creation_state: "ready",
            preference_last_error: null,
          })
          .eq("id", row.intento_pago_id)
          .is("preference_id", null)
          .in("preference_creation_state", ["creating", "ambiguous"]);

    const { data, error } = await query.select(PREFERENCE_SELECT).maybeSingle();
    if (error) throw new Error("preference_persistence_failed");

    const finalState = data?.id
      ? (data as IntentoPreferenceRow)
      : await readPreferenceState();
    if (!finalState) throw new Error("preference_persistence_failed");
    assertPreferenceMatchesPersisted(preference, finalState);
    return finalState;
  };

  let intento = await readPreferenceState();
  if (!intento) return res.status(500).json({ error: "unexpected_error" });

  let mode: ReturnType<typeof getPreferenceResolutionMode>;
  try {
    mode = getPreferenceResolutionMode(intento);
  } catch {
    return res.status(409).json({ error: "mercadopago_preference_conflict" });
  }

  if (mode === "claim") {
    const startedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await serviceClient
      .from("intento_pago")
      .update({
        preference_creation_state: "creating",
        preference_creation_started_at: startedAt,
        preference_last_error: null,
      })
      .eq("id", row.intento_pago_id)
      .eq("preference_creation_state", "not_started")
      .is("preference_id", null)
      .select(PREFERENCE_SELECT)
      .maybeSingle();

    if (claimError) return res.status(500).json({ error: "unexpected_error" });
    if (claimed?.id) {
      intento = claimed as IntentoPreferenceRow;
      mode = "claim";
    } else {
      intento = await readPreferenceState();
      if (!intento) return res.status(500).json({ error: "unexpected_error" });
      try {
        mode = getPreferenceResolutionMode(intento);
      } catch {
        return res.status(409).json({ error: "mercadopago_preference_conflict" });
      }
    }
  }

  if (mode === "in_progress") {
    res.setHeader("Retry-After", "2");
    return res.status(503).json({ error: "mercadopago_preference_in_progress" });
  }

  if (mode === "failed") {
    return res.status(502).json({ error: "mercadopago_preference_error" });
  }

  if (mode === "reuse") {
    if (intento.preference_creation_state !== "ready") {
      const { data: normalized, error } = await serviceClient
        .from("intento_pago")
        .update({ preference_creation_state: "ready", preference_last_error: null })
        .eq("id", row.intento_pago_id)
        .eq("preference_id", intento.preference_id as string)
        .eq("preference_init_point", intento.preference_init_point as string)
        .select(PREFERENCE_SELECT)
        .maybeSingle();
      if (error || !normalized?.id) {
        return res.status(409).json({ error: "mercadopago_preference_conflict" });
      }
      intento = normalized as IntentoPreferenceRow;
    }
  } else if (mode === "recover") {
    try {
      const recovered = await recoverMercadoPagoPreference({
        accessToken: MP_ACCESS_TOKEN,
        preferenceId: intento.preference_id as string,
        expected: expectedPreference,
      });
      intento = await persistReadyPreference(recovered, "recover");
    } catch (error) {
      const code = preferenceErrorCode(error);
      await markBridgeState("ambiguous", ["not_started", "creating", "ambiguous", "failed"], code);
      const conflict = code === "mercadopago_preference_mismatch" ||
        code === "mercadopago_preference_conflict";
      return res.status(conflict ? 409 : 502).json({
        error: conflict ? "mercadopago_preference_conflict" : "mercadopago_preference_error",
      });
    }
  } else {
    if (mode === "reconcile" && intento.preference_creation_state === "creating") {
      await markBridgeState("ambiguous", ["creating"], "mercadopago_preference_stale");
    }

    let resolved: MercadoPagoPreference;
    if (mode === "claim") {
      try {
        resolved = await createMercadoPagoPreference({
          accessToken: MP_ACCESS_TOKEN,
          expected: expectedPreference,
          notificationUrl,
          backUrls,
        });
      } catch (error) {
        const bridgeError = error instanceof MercadoPagoBridgeError ? error : null;
        if (!bridgeError?.ambiguous) {
          await markBridgeState("failed", ["creating"], preferenceErrorCode(error));
          return res.status(502).json({ error: "mercadopago_preference_error" });
        }
        await markBridgeState("ambiguous", ["creating"], preferenceErrorCode(error));
        mode = "reconcile";
      }
    }

    if (mode === "reconcile") {
      try {
        resolved = await reconcileMercadoPagoPreference({
          accessToken: MP_ACCESS_TOKEN,
          expected: expectedPreference,
        });
      } catch (error) {
        const code = preferenceErrorCode(error);
        await markBridgeState("ambiguous", ["creating", "ambiguous"], code);
        const conflict = code === "mercadopago_preference_conflict" ||
          code === "mercadopago_preference_mismatch";
        res.setHeader("Retry-After", "5");
        return res.status(conflict ? 409 : 503).json({
          error: conflict
            ? "mercadopago_preference_conflict"
            : "mercadopago_preference_ambiguous",
        });
      }
    }

    try {
      intento = await persistReadyPreference(resolved!, "new");
    } catch (error) {
      await markBridgeState(
        "ambiguous",
        ["creating", "ambiguous"],
        preferenceErrorCode(error),
      );
      return res.status(500).json({ error: "unexpected_error" });
    }
  }

  if (!intento.preference_id || !intento.preference_init_point) {
    return res.status(409).json({ error: "mercadopago_preference_conflict" });
  }

  return res.status(201).json({
    intento_pago: {
      id: row.intento_pago_id,
      pedido_id: row.pedido_id,
      estado: row.estado_intento,
      preference_id: intento.preference_id,
      init_point: intento.preference_init_point,
    },
  });
}
