import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimitHeaders, checkRateLimit } from "../../../lib/apiSecurity";
import {
  authorizePanelRequest,
  createPanelServiceClient,
} from "../../../lib/panelAuthorization";

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
    source_mode: "tolerante";
    resumen_ok: boolean;
    resumen_count: number;
    auth_mode: "bearer_or_cookie";
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
    key: "api:panel:productos:list",
    limit: 60,
    windowMs: 60_000,
  });

  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (Object.prototype.hasOwnProperty.call(req.query, "empresa_id")) {
    return res.status(400).json({ error: "legacy_tenant_input" });
  }

  const authorization = await authorizePanelRequest(req, "catalog.operate");
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error });
  }

  try {
    const serviceClient = createPanelServiceClient();
    const { data: productosData, error: productosError } = await serviceClient
      .from("producto")
      .select("id, nombre, descripcion, precio, estado, stock")
      .eq("empresa_id", authorization.principal.empresaId)
      .order("nombre", { ascending: true })
      .returns<ProductoRow[]>();

    if (productosError) {
      return res.status(500).json({ error: "internal_error" });
    }

    const { data: resumenData, error: resumenError } = await serviceClient
      .from("producto_stock_resumen")
      .select("producto_id, stock_total, usa_variantes")
      .eq("empresa_id", authorization.principal.empresaId)
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