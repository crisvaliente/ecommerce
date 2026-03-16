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
      rpc: RpcRow | null;
    };

type ApiErr = {
  error: string;
  detail?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const DEV_WEBHOOK_MODE = process.env.MP_WEBHOOK_DEV_MODE === "1";

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

function validateMpWebhookSignature(req: NextApiRequest): boolean {
  if (!MP_WEBHOOK_SECRET) return false;

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  const xSignatureValue =
    typeof xSignature === "string" ? xSignature : xSignature?.[0] ?? null;
  const xRequestIdValue =
    typeof xRequestId === "string" ? xRequestId : xRequestId?.[0] ?? null;

  const { ts, v1 } = parseHeaderSignature(xSignatureValue);

  const dataIdFromQuery =
    getSingleQueryValue(req.query["data.id"]) ??
    getSingleQueryValue(req.query.id) ??
    null;

  if (!ts || !v1 || !xRequestIdValue || !dataIdFromQuery) {
    return false;
  }

  const manifest = buildWebhookManifest({
    dataId: dataIdFromQuery,
    xRequestId: xRequestIdValue,
    ts,
  });

  const calculated = crypto
    .createHmac("sha256", MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  return safeCompareHex(calculated, v1);
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
  const signatureOk = devBypass ? true : validateMpWebhookSignature(req);

  console.log("[mp-webhook] signature", {
    traceId,
    signatureOk,
    devBypass,
  });

  if (!signatureOk) {
    return res.status(401).json({ error: "invalid_webhook_signature" });
  }

  const paymentId =
    getSingleQueryValue(req.query["data.id"]) ??
    (body.data?.id != null ? String(body.data.id) : null);

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
        console.warn("[mp-webhook] payment lookup failed", {
          traceId,
          paymentId,
          eventType,
          action: body.action ?? null,
          reason: "payment_lookup_failed",
          detail: err instanceof Error ? err.message : "unknown_error",
        });

        return res.status(200).json({
          ok: true,
          absorbed: true,
          reason: "payment_lookup_failed",
          paymentId,
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
    });

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

    return res.status(200).json({
      ok: true,
      absorbed: true,
      reason: "payment_processed",
      payment_id: externalId,
      intento_pago_id: externalReference,
      mp_status: mpStatus,
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
