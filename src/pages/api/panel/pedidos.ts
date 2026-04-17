import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { applyRateLimitHeaders, checkRateLimit } from "../../lib/apiSecurity";

type PedidoEstado =
  | "pendiente_pago"
  | "pagado"
  | "bloqueado"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

type PedidoRow = {
  pedido_id: string;
  estado: PedidoEstado;
  total: number | string;
  creado_en: string;
  expira_en: string;
  bloqueado_por_stock: boolean;
};

type ApiOk = {
  pedidos: PedidoRow[];
  meta: {
    count: number;
  };
};

type ApiErr = { error: string };

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "unknown error";
}

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: "api:panel:pedidos:list",
    limit: 60,
    windowMs: 60_000,
  });

  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    return res.status(500).json({
      error:
        "Server misconfigured: falta NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const access_token = getAccessToken(req);
  if (!access_token) {
    return res.status(401).json({ error: "Falta access token" });
  }

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();

  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: perfil, error: perfilErr } = await supabaseAdmin
    .from("usuario")
    .select("empresa_id")
    .eq("supabase_uid", userData.user.id)
    .maybeSingle();

  if (perfilErr) {
    return res
      .status(500)
      .json({ error: `Error validando usuario: ${perfilErr.message}` });
  }

  if (!perfil?.empresa_id) {
    return res.status(403).json({ error: "Usuario sin empresa asociada" });
  }

  try {
    const { data: pedidosData, error: pedidosError } = await supabaseAdmin
      .from("pedido")
      .select("id, estado, total, creado_en, expira_en, bloqueado_por_stock")
      .eq("empresa_id", perfil.empresa_id)
      .order("creado_en", { ascending: false })
      .limit(50);

    if (pedidosError) {
      return res.status(500).json({ error: pedidosError.message });
    }

    const pedidos: PedidoRow[] = (pedidosData ?? []).map((pedido) => ({
      pedido_id: pedido.id,
      estado: pedido.estado as PedidoEstado,
      total: Number(pedido.total),
      creado_en: pedido.creado_en,
      expira_en: pedido.expira_en,
      bloqueado_por_stock: Boolean(pedido.bloqueado_por_stock),
    }));

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Panel-Only", "1");
    res.setHeader("X-Auth-Mode", "bearer_or_cookie");

    return res.status(200).json({
      pedidos,
      meta: {
        count: pedidos.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: getErrorMessage(error) });
  }
}
