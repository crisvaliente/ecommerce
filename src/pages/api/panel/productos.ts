import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimitHeaders, checkRateLimit } from "../../../lib/apiSecurity";
import { authorizePanelAccess } from "../../../lib/panelAuthorization";

type ProductoEstado = "draft" | "published";

type ProductoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: ProductoEstado;
  stock: number | null;
};

type StockResumenRow = {
  producto_id: string;
  stock_total: number;
  usa_variantes: boolean;
};

type ProductoPanelDTO = {
  producto_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: ProductoEstado;
  usa_variantes: boolean;
  stock_base: number;
  stock_efectivo: number;
  stock_source: "view" | "legacy";
};

type ApiOk = {
  items: ProductoPanelDTO[];
  meta: {
    empresa_id: string;
    source_mode: "tolerante";
    resumen_ok: boolean;
    resumen_count: number;
    auth_mode: "bearer_or_cookie";
  };
};

type ApiErr = { error: string };

function getEmpresaId(req: NextApiRequest): string | null {
  const raw = req.query.empresa_id;
  const empresa_id = Array.isArray(raw) ? raw[0] : raw;
  if (!empresa_id || typeof empresa_id !== "string") return null;
  const trimmed = empresa_id.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    key: "api:panel:productos:list",
    limit: 60,
    windowMs: 60_000,
  });

  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  const empresa_id = getEmpresaId(req);
  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id requerido" });
  }

  const authorization = await authorizePanelAccess(req, empresa_id);
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error });
  }

  try {
    const { data: productosData, error: productosError } = await authorization.supabaseAdmin
      .from("producto")
      .select("id, nombre, descripcion, precio, estado, stock")
      .eq("empresa_id", authorization.empresaId)
      .order("nombre", { ascending: true })
      .returns<ProductoRow[]>();

    if (productosError) {
      return res.status(500).json({ error: "internal_error" });
    }

    const { data: resumenData, error: resumenError } = await authorization.supabaseAdmin
      .from("producto_stock_resumen")
      .select("producto_id, stock_total, usa_variantes")
      .eq("empresa_id", authorization.empresaId)
      .returns<StockResumenRow[]>();

    const resumen_ok = !resumenError;
    const resumenMap = new Map<string, StockResumenRow>(
      (resumenData ?? []).map((r) => [r.producto_id, r])
    );

    const items: ProductoPanelDTO[] = (productosData ?? []).map((p) => {
      const r = resumenMap.get(p.id);

      const stock_base = typeof p.stock === "number" ? p.stock : 0;
      const has_view_stock = typeof r?.stock_total === "number";
      const stock_efectivo = has_view_stock ? (r!.stock_total as number) : stock_base;

      const usa_variantes = typeof r?.usa_variantes === "boolean" ? r.usa_variantes : false;

      return {
        producto_id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        estado: p.estado,
        usa_variantes,
        stock_base,
        stock_efectivo,
        stock_source: has_view_stock ? "view" : "legacy",
      };
    });

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Panel-Only", "1");
    res.setHeader("X-Auth-Mode", "bearer_or_cookie");
    res.setHeader("X-Stock-Mode", "B1-panel-tolerante");
    res.setHeader("X-Stock-Resumen-OK", resumen_ok ? "1" : "0");

    return res.status(200).json({
      items,
      meta: {
        empresa_id: authorization.empresaId,
        source_mode: "tolerante",
        resumen_ok,
        resumen_count: resumenData?.length ?? 0,
        auth_mode: "bearer_or_cookie",
      },
    });
  } catch {
    return res.status(500).json({ error: "internal_error" });
  }
}