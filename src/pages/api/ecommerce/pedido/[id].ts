import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type PedidoItemResponse = {
  producto_id: string;
  variante_id: string | null;
  nombre_producto: string;
  talle: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
};

type ApiOk = {
  pedido: {
    pedido_id: string;
    estado: string;
    total: number;
    expira_en: string;
    direccion_envio_snapshot: unknown;
    creado_en: string;
    actualizado_en: string;
    items: PedidoItemResponse[];
  };
};

type ApiErr = {
  error: string;
};

function getAccessToken(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;

  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }

  const cookie = req.headers.cookie;

  if (!cookie || typeof cookie !== "string") {
    return null;
  }

  const m = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (m?.[1]) {
    return decodeURIComponent(m[1]);
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rawId = req.query.id;
  const pedidoId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!pedidoId || typeof pedidoId !== "string" || !pedidoId.trim()) {
    return res.status(404).json({ error: "pedido_no_encontrado" });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  try {
    const accessToken = getAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userErr } =
      await supabaseAuth.auth.getUser();

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from("usuario")
      .select("id, empresa_id")
      .eq("supabase_uid", userData.user.id)
      .maybeSingle();

    if (perfilErr) {
      console.error("[GET /api/ecommerce/pedido/:id] perfilErr", perfilErr);
      return res.status(500).json({ error: "internal_error" });
    }

    if (!perfil?.id) {
      return res.status(403).json({ error: "forbidden" });
    }

    const usuarioDbId = perfil.id;

    const { data: pedido, error: pedidoErr } = await supabaseAdmin
      .from("pedido")
      .select(`
        id,
        empresa_id,
        estado,
        total,
        expira_en,
        direccion_envio_snapshot,
        creado_en,
        actualizado_en
      `)
      .eq("id", pedidoId)
      .eq("usuario_id", usuarioDbId)
      .maybeSingle();

    if (pedidoErr) {
      console.error("[GET /api/ecommerce/pedido/:id] pedidoErr", pedidoErr);
      return res.status(500).json({ error: "internal_error" });
    }

    if (!pedido) {
      return res.status(404).json({ error: "pedido_no_encontrado" });
    }

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("pedido_item")
      .select(`
        producto_id,
        variante_id,
        nombre_producto,
        talle,
        precio_unitario,
        cantidad,
        subtotal
      `)
      .eq("pedido_id", pedido.id)
      .eq("empresa_id", pedido.empresa_id);

    if (itemsErr) {
      console.error("[GET /api/ecommerce/pedido/:id] itemsErr", itemsErr);
      return res.status(500).json({ error: "internal_error" });
    }

    return res.status(200).json({
      pedido: {
        pedido_id: pedido.id,
        estado: pedido.estado,
        total: Number(pedido.total),
        expira_en: pedido.expira_en,
        direccion_envio_snapshot: pedido.direccion_envio_snapshot,
        creado_en: pedido.creado_en,
        actualizado_en: pedido.actualizado_en,
        items: (items ?? []).map((item) => ({
          producto_id: item.producto_id,
          variante_id: item.variante_id,
          nombre_producto: item.nombre_producto,
          talle: item.talle,
          precio_unitario: Number(item.precio_unitario),
          cantidad: Number(item.cantidad),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/ecommerce/pedido/:id] unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}