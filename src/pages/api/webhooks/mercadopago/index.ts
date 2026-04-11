import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type MpWebhookBody = {
  action?: string;
  api_version?: string;
  data?: {
    id?: string | number;
  };
  dev_mock_payment?: {
    id?: string | number;
    status?: string | null;
    status_detail?: string | null;
    external_reference?: string | null;
  };
  date_created?: string;
  id?: string | number;
  live_mode?: boolean;
  type?: string;
  user_id?: string | number;
};

type MpPaymentResponse = {
  id: string | number;
  status: string | null;
  status_detail?: string | null;
  external_reference?: string | null;
};

type RpcRow = {
  ok: boolean;
  codigo_resultado: string;
  intento_pago_id: string | null;
  pedido_id: string | null;
  estado_anterior: string | null;
  estado_actual: string | null;
  consolidacion_ejecutada: boolean | null;
  consolidacion_ok: boolean | null;
  consolidacion_codigo: string | null;
  pedido_estado_final: string | null;
  intento_pago_consolidado_id: string | null;
};

type ApiOk =
  | {
      ok: true;
      absorbed: true;
      reason:
        | "not_payment_event"
        | "missing_payment_id"
        | "payment_lookup_failed"
        | "payment_without_external_reference"
        | "payment_not_correlatable"
        | "payment_status_ignored";
      paymentId?: string;
    }
  | {
      ok: true;
      absorbed: true;
      reason: "payment_processed";
      payment_id: string;
      intento_pago_id: string;
      mp_status: string | null;
      signature_verified: boolean;
      fallback_used: boolean;
      rpc: RpcRow | null;
    };

type ApiErr = {
  error: string;
  detail?: string;
  consolidacion_codigo?: string | null;
  pedido_estado_final?: string | null;
  intento_pago_consolidado_id?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const DEV_WEBHOOK_MODE = process.env.MP_WEBHOOK_DEV_MODE === "1";
const LOOKUP_FALLBACK_ENABLED = process.env.MP_WEBHOOK_ALLOW_LOOKUP_FALLBACK === "1";

function getSingleQueryValue(
  value: string | string[] | undefined
): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseHeaderSignature(headerValue: string | null): {
  ts: string | null;
  v1: string | null;
} {
  if (!headerValue) return { ts: null, v1: null };

  let ts: string | null = null;
  let v1: string | null = null;

  for (const rawPart of headerValue.split(",")) {
    const [rawKey, rawValue] = rawPart.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();

    if (!key || !value) continue;
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  return { ts, v1 };
}

function safeCompareHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");

  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildWebhookManifest(params: {
  dataId: string;
  xRequestId: string;
  ts: string;
}): string {
  return `id:${params.dataId};request-id:${params.xRequestId};ts:${params.ts};`;
}

function resolveWebhookPaymentId(
  req: NextApiRequest,
  body?: MpWebhookBody
): string | null {
  return (
    getSingleQueryValue(req.query["data.id"]) ??
    (body?.data?.id != null ? String(body.data.id) : null) ??
    getSingleQueryValue(req.query.id) ??
    null
  );
}

function validateMpWebhookSignature(
  req: NextApiRequest,
  paymentId: string | null
): boolean {
  if (!MP_WEBHOOK_SECRET) return false;

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  const xSignatureValue =
    typeof xSignature === "string" ? xSignature : xSignature?.[0] ?? null;
  const xRequestIdValue =
    typeof xRequestId === "string" ? xRequestId : xRequestId?.[0] ?? null;

  const { ts, v1 } = parseHeaderSignature(xSignatureValue);

  const body = (req.body ?? {}) as MpWebhookBody;
  const queryDataId = getSingleQueryValue(req.query["data.id"]);
  const queryId = getSingleQueryValue(req.query.id);
  const bodyDataId = body.data?.id != null ? String(body.data.id) : null;
  const signatureDataId = queryDataId;
  const secretRaw = MP_WEBHOOK_SECRET ?? "";
  const secretPreview =
    secretRaw.length > 0 ? `${secretRaw.slice(0, 2)}***${secretRaw.slice(-4)}` : null;
  const v1Preview = v1 ? `${v1.slice(0, 8)}...${v1.slice(-4)}` : null;
  const xRequestIdPreview = xRequestIdValue
    ? `${xRequestIdValue.slice(0, 12)}...`
    : null;

  console.log("[mp-webhook] signature_inputs", {
    tsParsed: ts,
    v1Preview,
    xRequestIdPreview,
    queryDataId,
    bodyDataId,
    queryId,
    signatureDataId,
    manifest: null,
    secretLength: secretRaw.length,
    secretPreview,
    calculatedPreview: null,
    receivedPreview: v1Preview,
    signatureMatch: null,
  });

  if (!ts || !v1 || !xRequestIdValue || !paymentId) {
    console.log("[mp-webhook] signature_missing_inputs", {
      tsParsed: ts,
      v1Preview,
      xRequestIdPreview,
      queryDataId,
      bodyDataId,
      queryId,
      signatureDataId,
      manifest: null,
      secretLength: secretRaw.length,
      secretPreview,
      calculatedPreview: null,
      receivedPreview: v1Preview,
      signatureMatch: null,
    });
    return false;
  }

  const manifest = buildWebhookManifest({
    dataId: paymentId,
    xRequestId: xRequestIdValue,
    ts,
  });

  const calculated = crypto
    .createHmac("sha256", MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  const signatureMatch = safeCompareHex(calculated, v1);

  if (process.env.MP_WEBHOOK_DEBUG_FULL === "true") {
    console.log("[mp-webhook] signature_compare_full", {
      xSignatureRaw: xSignatureValue,
      xRequestIdRaw: xRequestIdValue,
      tsParsed: ts,
      v1Raw: v1,
      calculated,
      manifest,
      signatureMatch,
    });
  }

  console.log("[mp-webhook] signature_compare", {
    tsParsed: ts,
    v1Preview,
    xRequestIdPreview,
    queryDataId,
    bodyDataId,
    queryId,
    signatureDataId,
    manifest,
    secretLength: secretRaw.length,
    secretPreview,
    calculatedPreview: `${calculated.slice(0, 8)}...${calculated.slice(-4)}`,
    receivedPreview: `${v1.slice(0, 8)}...${v1.slice(-4)}`,
    signatureMatch,
  });

  return signatureMatch;
}

function isRpcSemanticSuccess(rpcRow: RpcRow | null): boolean {
  if (!rpcRow?.ok) return false;

  switch (rpcRow.codigo_resultado) {
    case "sin_cambios_idempotente":
    case "intento_actualizado":
    case "intento_aprobado_y_consolidado":
      return true;
    default:
      return false;
  }
}

function isRpcNonConsolidatedApproved(rpcRow: RpcRow | null): boolean {
  return rpcRow?.codigo_resultado === "intento_aprobado_no_consolidado";
}

function getTraceId(req: NextApiRequest): string {
  const xRequestId = req.headers["x-request-id"];
  const value = typeof xRequestId === "string" ? xRequestId : xRequestId?.[0] ?? null;
  return value?.trim() || crypto.randomUUID();
}

function isDevBypassEnabled(req: NextApiRequest): boolean {
  if (process.env.NODE_ENV === "production" || !DEV_WEBHOOK_MODE) {
    return false;
  }

  const raw = req.headers["x-dev-webhook-bypass"];
  const value = typeof raw === "string" ? raw : raw?.[0] ?? null;
  return value === "1";
}

function getMockPaymentFromBody(body: MpWebhookBody): MpPaymentResponse | null {
  const mock = body.dev_mock_payment;

  if (!mock?.id) return null;

  return {
    id: mock.id,
    status: mock.status ?? null,
    status_detail: mock.status_detail ?? null,
    external_reference: mock.external_reference?.trim() ?? null,
  };
}

function mapMpStatusToInternal(
  mpStatus: string | null | undefined
): "aprobado" | "rechazado" | "cancelado" | null {
  switch ((mpStatus ?? "").toLowerCase()) {
    case "approved":
      return "aprobado";
    case "rejected":
      return "rechazado";
    case "cancelled":
      return "cancelado";
    default:
      return null;
  }
}

async function fetchMpPayment(paymentId: string): Promise<MpPaymentResponse> {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
  }

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MercadoPago GET /v1/payments/${paymentId} failed: ${resp.status} ${text}`);
  }

  return (await resp.json()) as MpPaymentResponse;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  const traceId = getTraceId(req);

  if (req.method !== "POST") {
    console.log("[mp-webhook] method_not_allowed", { traceId, method: req.method });
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET) {
    console.error("[mp-webhook] server_misconfigured", {
      traceId,
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceRole: Boolean(SERVICE_ROLE),
      hasMpAccessToken: Boolean(MP_ACCESS_TOKEN),
      hasWebhookSecret: Boolean(MP_WEBHOOK_SECRET),
    });
    return res.status(500).json({ error: "server_misconfigured" });
  }

  const body = (req.body ?? {}) as MpWebhookBody;
  const paymentId = resolveWebhookPaymentId(req, body);

  const eventType =
    body.type ??
    getSingleQueryValue(req.query.type) ??
    getSingleQueryValue(req.query.topic);

  console.log("[mp-webhook] incoming", {
    traceId,
    method: req.method,
    eventType,
    bodyType: body.type ?? null,
    bodyAction: body.action ?? null,
    queryDataId: getSingleQueryValue(req.query["data.id"]),
    bodyDataId: body.data?.id != null ? String(body.data.id) : null,
    devBypass: isDevBypassEnabled(req),
  });

  if (eventType !== "payment") {
    console.log("[mp-webhook] absorbed", {
      traceId,
      reason: "not_payment_event",
      eventType,
    });
    return res.status(200).json({
      ok: true,
      absorbed: true,
      reason: "not_payment_event",
    });
  }

  const devBypass = isDevBypassEnabled(req);
  const signatureOk = devBypass ? true : validateMpWebhookSignature(req, paymentId);
  const lookupFallbackEnabled = !devBypass && LOOKUP_FALLBACK_ENABLED;
  const shouldAttemptLookupFallback = !signatureOk && lookupFallbackEnabled && Boolean(paymentId);

  console.log("[mp-webhook] signature", {
    traceId,
    signatureOk,
    devBypass,
    lookupFallbackEnabled,
    shouldAttemptLookupFallback,
  });

  if (!signatureOk && !shouldAttemptLookupFallback) {
    return res.status(401).json({ error: "invalid_webhook_signature" });
  }

  console.log("[mp-webhook] payment_id", {
    traceId,
    paymentId,
  });

  if (!paymentId) {
    console.log("[mp-webhook] absorbed", {
      traceId,
      reason: "missing_payment_id",
    });
    return res.status(200).json({
      ok: true,
      absorbed: true,
      reason: "missing_payment_id",
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  try {
    let mpPayment: MpPaymentResponse;
    const mockPayment = devBypass ? getMockPaymentFromBody(body) : null;

    if (mockPayment) {
      mpPayment = mockPayment;
      console.log("[mp-webhook] payment_lookup_mock", {
        traceId,
        paymentId,
        mpPayment,
      });
    } else {
      try {
        mpPayment = await fetchMpPayment(paymentId);
        console.log("[mp-webhook] payment_lookup", {
          traceId,
          paymentId,
          mpPaymentId: String(mpPayment.id),
          mpStatus: mpPayment.status ?? null,
          externalReference: mpPayment.external_reference ?? null,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "unknown_error";

        console.error("[mp-webhook] payment lookup failed", {
          traceId,
          paymentId,
          eventType,
          action: body.action ?? null,
          reason: "payment_lookup_failed",
          detail,
        });

        return res.status(502).json({
          error: "payment_lookup_failed",
          detail,
        });
      }
    }

    const externalId = String(mpPayment.id);
    const externalReference = mpPayment.external_reference?.trim() ?? null;
    const mpStatus = mpPayment.status ?? null;
    const internalTargetStatus = mapMpStatusToInternal(mpStatus);

    console.log("[mp-webhook] payment_resolved", {
      traceId,
      externalId,
      externalReference,
      mpStatus,
      internalTargetStatus,
      signatureOk,
      fallbackUsed: shouldAttemptLookupFallback,
    });

    if (shouldAttemptLookupFallback) {
      console.warn("[mp-webhook] processing via lookup fallback", {
        traceId,
        paymentId: externalId,
        externalReference,
        mpStatus,
      });
    }

    if (!externalReference) {
      console.log("[mp-webhook] absorbed", {
        traceId,
        reason: "payment_without_external_reference",
        paymentId,
      });
      return res.status(200).json({
        ok: true,
        absorbed: true,
        reason: "payment_without_external_reference",
      });
    }

    const { data: existingIntent, error: existingIntentErr } = await supabase
      .from("intento_pago")
      .select("id")
      .eq("id", externalReference)
      .maybeSingle();

    console.log("[mp-webhook] correlation", {
      traceId,
      externalReference,
      foundIntent: Boolean(existingIntent),
      readError: existingIntentErr?.message ?? null,
      fallbackUsed: shouldAttemptLookupFallback,
    });

    if (existingIntentErr) {
      return res.status(500).json({
        error: "db_read_failed",
        detail: existingIntentErr.message,
      });
    }

    if (!existingIntent) {
      console.log("[mp-webhook] absorbed", {
        traceId,
        reason: "payment_not_correlatable",
        externalReference,
      });
      return res.status(200).json({
        ok: true,
        absorbed: true,
        reason: "payment_not_correlatable",
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("intento_pago")
      .update({
        external_id: externalId,
        notificado_en: nowIso,
        ultimo_evento_tipo: body.action ?? "payment.webhook",
        ultimo_evento_payload: mpPayment, // snapshot confirmado del pago
      })
      .eq("id", externalReference);

    console.log("[mp-webhook] snapshot_update", {
      traceId,
      intentoPagoId: externalReference,
      externalId,
      updateOk: !updateErr,
      updateError: updateErr?.message ?? null,
    });

    if (updateErr) {
      return res.status(500).json({
        error: "db_update_failed",
        detail: updateErr.message,
      });
    }

    if (!internalTargetStatus) {
      console.log("[mp-webhook] absorbed", {
        traceId,
        reason: "payment_status_ignored",
        mpStatus,
      });
      return res.status(200).json({
        ok: true,
        absorbed: true,
        reason: "payment_status_ignored",
      });
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "procesar_notificacion_intento_pago",
      {
        p_intento_pago_id: externalReference,
        p_estado_objetivo: internalTargetStatus,
      }
    );

    const rpcRow = Array.isArray(rpcData)
      ? ((rpcData[0] ?? null) as RpcRow | null)
      : ((rpcData ?? null) as RpcRow | null);

    console.log("[mp-webhook] rpc", {
      traceId,
      intentoPagoId: externalReference,
      internalTargetStatus,
      rpcError: rpcErr?.message ?? null,
      rpcRow,
    });

    if (rpcErr) {
      return res.status(500).json({
        error: "rpc_failed",
        detail: rpcErr.message,
      });
    }

    if (!rpcRow) {
      console.error("[mp-webhook] rpc semantic failure", {
        traceId,
        intentoPagoId: externalReference,
        paymentId: externalId,
        reason: "rpc_without_result",
      });

      return res.status(500).json({
        error: "rpc_without_result",
      });
    }

    if (!isRpcSemanticSuccess(rpcRow)) {
      console.error("[mp-webhook] rpc semantic failure", {
        traceId,
        intentoPagoId: externalReference,
        paymentId: externalId,
        codigoResultado: rpcRow.codigo_resultado,
        rpcOk: rpcRow.ok,
        consolidacionOk: rpcRow.consolidacion_ok,
        consolidacionCodigo: rpcRow.consolidacion_codigo,
        pedidoEstadoFinal: rpcRow.pedido_estado_final,
        intentoPagoConsolidadoId: rpcRow.intento_pago_consolidado_id,
      });

      if (isRpcNonConsolidatedApproved(rpcRow)) {
        return res.status(409).json({
          error: "payment_approved_not_consolidated",
          detail: rpcRow.codigo_resultado,
          consolidacion_codigo: rpcRow.consolidacion_codigo,
          pedido_estado_final: rpcRow.pedido_estado_final,
          intento_pago_consolidado_id: rpcRow.intento_pago_consolidado_id,
        });
      }

      return res.status(409).json({
        error: "rpc_semantic_failure",
        detail: rpcRow.codigo_resultado,
      });
    }

    return res.status(200).json({
      ok: true,
      absorbed: true,
      reason: "payment_processed",
      payment_id: externalId,
      intento_pago_id: externalReference,
      mp_status: mpStatus,
      signature_verified: signatureOk,
      fallback_used: shouldAttemptLookupFallback,
      rpc: rpcRow,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown_error";
    console.error("[mp-webhook] unexpected", {
      traceId,
      detail,
    });
    return res.status(500).json({
      error: "webhook_processing_failed",
      detail,
    });
  }
}
