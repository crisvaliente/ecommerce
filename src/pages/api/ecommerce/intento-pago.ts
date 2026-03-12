import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type RpcRow = {
  ok: boolean;
  codigo_resultado: string;
  intento_pago_id: string | null;
  pedido_id: string | null;
  estado_intento: string | null;
};

type ApiOk = {
  intento_pago: {
    id: string;
    pedido_id: string;
    estado: string;
  };
};

type ApiErr = {
  error: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
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

  if (!row) {
    return res.status(500).json({ error: "unexpected_error" });
  }

  if (row.ok && row.codigo_resultado === "creado") {
    if (!row.intento_pago_id || !row.pedido_id || !row.estado_intento) {
      return res.status(500).json({ error: "unexpected_error" });
    }

    return res.status(201).json({
      intento_pago: {
        id: row.intento_pago_id,
        pedido_id: row.pedido_id,
        estado: row.estado_intento,
      },
    });
  }

  const status = mapRpcErrorToStatus(row.codigo_resultado);
  const errorCode =
    status === 500 ? "unexpected_error" : row.codigo_resultado || "unexpected_error";

  return res.status(status).json({ error: errorCode });
}