import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimitHeaders, checkRateLimit } from "../../../lib/apiSecurity";
import { authorizePanelAccess } from "../../../lib/panelAuthorization";

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

  const authorization = await authorizePanelAccess(req);
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error });
  }

  try {
    const { data: pedidosData, error: pedidosError } = await authorization.supabaseAdmin
      .from("pedido")
      .select("id, estado, total, creado_en, expira_en, bloqueado_por_stock")
      .eq("empresa_id", authorization.empresaId)
      .order("creado_en", { ascending: false })
      .limit(50);

    if (pedidosError) {
      return res.status(500).json({ error: "internal_error" });
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
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
}