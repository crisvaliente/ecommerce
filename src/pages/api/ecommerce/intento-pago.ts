import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
};

type PreferenceCreateResponse = {
  id: string;
  init_point: string | null;
  sandbox_init_point?: string | null;
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

async function createMercadoPagoPreference(params: {
  accessToken: string;
  externalReference: string;
  pedidoId: string;
  total: number;
  notificationUrl: string;
}): Promise<PreferenceCreateResponse> {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
      items: [
        {
          id: params.pedidoId,
          title: `Pedido ${params.pedidoId}`,
          quantity: 1,
          unit_price: params.total,
          currency_id: "UYU",
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("mercadopago_preference_error");
  }

  return (await response.json()) as PreferenceCreateResponse;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
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
    .select("id, total")
    .eq("id", row.pedido_id)
    .single();

  console.log("[intento-pago] pedidoRow", {
    pedidoError,
    pedidoRow,
  });

  const pedido = pedidoRow as PedidoRow | null;
  const total = toAmount(pedido?.total ?? null);

  if (pedidoError || !pedido?.id || total === null) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  const notificationUrl = `${normalizeBaseUrl(APP_BASE_URL)}/api/webhooks/mercadopago`;

  let preference: PreferenceCreateResponse;

  try {
    preference = await createMercadoPagoPreference({
      accessToken: MP_ACCESS_TOKEN,
      externalReference: row.intento_pago_id,
      pedidoId: row.pedido_id,
      total,
      notificationUrl,
    });
    console.log("[intento-pago] mp response", {
      ok: true,
      body: preference,
    });
  } catch {
    console.error("[intento-pago] mp response", {
      ok: false,
      body: null,
    });
    // El intento interno ya existe y queda en "iniciado".
    // En v1 no compensamos: permitimos reintentar la apertura del bridge.
    return res.status(502).json({ error: "mercadopago_preference_error" });
  }

  const initPoint = preference.init_point ?? preference.sandbox_init_point ?? null;

  console.log("[intento-pago] mp parsed", {
    id: preference.id,
    init_point: preference.init_point,
    sandbox_init_point: preference.sandbox_init_point ?? null,
    resolved_init_point: initPoint,
  });

  if (!preference.id || !initPoint) {
    return res.status(502).json({ error: "mercadopago_preference_error" });
  }

  const { error: updateError } = await serviceClient
    .from("intento_pago")
    .update({
      preference_id: preference.id,
    })
    .eq("id", row.intento_pago_id);

  console.log("[intento-pago] update intento_pago", {
    intento_pago_id: row.intento_pago_id,
    preference_id: preference.id,
    updateError,
  });

  if (updateError) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  return res.status(201).json({
    intento_pago: {
      id: row.intento_pago_id,
      pedido_id: row.pedido_id,
      estado: row.estado_intento,
      preference_id: preference.id,
      init_point: initPoint,
    },
  });
}
