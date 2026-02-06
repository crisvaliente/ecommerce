import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

  // Guard env vars antes de crear clientes
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    return res.status(500).json({
      error:
        "Server misconfigured: falta NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const empresa_id = getEmpresaId(req);
  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id requerido" });
  }

  const access_token = getAccessToken(req);
  if (!access_token) {
    return res.status(401).json({ error: "Falta access token" });
  }

  // Cliente para validar usuario (sin bypass RLS)
  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } =
    await supabaseAuth.auth.getUser();

  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  // Cliente service-role SOLO después de auth OK
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Validar pertenencia usando tabla usuario + supabase_uid
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

  if (perfil.empresa_id !== empresa_id) {
    return res.status(403).json({ error: "No autorizado para esta empresa" });
  }

  try {
    // 1) Productos base
    const { data: productosData, error: productosError } =
      await supabaseAdmin
        .from("producto")
        .select("id, nombre, descripcion, precio, estado, stock")
        .eq("empresa_id", empresa_id)
        .order("nombre", { ascending: true })
        .returns<ProductoRow[]>();

    if (productosError) {
      return res.status(500).json({ error: productosError.message });
    }

    // 2) View resumen (tolerante)
    const { data: resumenData, error: resumenError } =
      await supabaseAdmin
        .from("producto_stock_resumen")
        .select("producto_id, stock_total, usa_variantes")
        .eq("empresa_id", empresa_id)
        .returns<StockResumenRow[]>();

    const resumen_ok = !resumenError;

    const resumenMap = new Map<string, StockResumenRow>(
      (resumenData ?? []).map((r) => [r.producto_id, r])
    );

    const items: ProductoPanelDTO[] = (productosData ?? []).map((p) => {
      const r = resumenMap.get(p.id);

      const stock_base = typeof p.stock === "number" ? p.stock : 0;
      const has_view_stock = typeof r?.stock_total === "number";
      const stock_efectivo = has_view_stock
        ? (r!.stock_total as number)
        : stock_base;

      const usa_variantes =
        typeof r?.usa_variantes === "boolean" ? r.usa_variantes : false;

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
        empresa_id,
        source_mode: "tolerante",
        resumen_ok,
        resumen_count: resumenData?.length ?? 0,
        auth_mode: "bearer_or_cookie",
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "unknown error" });
  }
}
