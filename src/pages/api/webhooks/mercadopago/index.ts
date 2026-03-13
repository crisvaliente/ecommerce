import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type MpWebhookBody = {
  action?: string;
  api_version?: string;
  data?: {
    id?: string | number;
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
        | "payment_without_external_reference"
        | "payment_not_correlatable"
        | "payment_status_ignored";
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  const body = (req.body ?? {}) as MpWebhookBody;

  const eventType =
    body.type ??
    getSingleQueryValue(req.query.type) ??
    getSingleQueryValue(req.query.topic);

  if (eventType !== "payment") {
    return res.status(200).json({
      ok: true,
      absorbed: true,
      reason: "not_payment_event",
    });
  }

  const signatureOk = validateMpWebhookSignature(req);

  if (!signatureOk) {
    return res.status(401).json({ error: "invalid_webhook_signature" });
  }

  const paymentId =
    getSingleQueryValue(req.query["data.id"]) ??
    (body.data?.id != null ? String(body.data.id) : null);

  if (!paymentId) {
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
    const mpPayment = await fetchMpPayment(paymentId);

    const externalId = String(mpPayment.id);
    const externalReference = mpPayment.external_reference?.trim() ?? null;
    const mpStatus = mpPayment.status ?? null;
    const internalTargetStatus = mapMpStatusToInternal(mpStatus);

    if (!externalReference) {
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

    if (existingIntentErr) {
      return res.status(500).json({
        error: "db_read_failed",
        detail: existingIntentErr.message,
      });
    }

    if (!existingIntent) {
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

    if (updateErr) {
      return res.status(500).json({
        error: "db_update_failed",
        detail: updateErr.message,
      });
    }

    if (!internalTargetStatus) {
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

    if (rpcErr) {
      return res.status(500).json({
        error: "rpc_failed",
        detail: rpcErr.message,
      });
    }

    const rpcRow = Array.isArray(rpcData)
      ? ((rpcData[0] ?? null) as RpcRow | null)
      : ((rpcData ?? null) as RpcRow | null);

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
    return res.status(500).json({
      error: "webhook_processing_failed",
      detail,
    });
  }
}