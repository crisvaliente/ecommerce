import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type PedidoEstado =
  | "pendiente_pago"
  | "pagado"
  | "bloqueado"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

type IntentoPagoEstado =
  | "iniciado"
  | "aprobado"
  | "rechazado"
  | "cancelado"
  | "expirado";

type PedidoItemResponse = {
  producto_id: string | null;
  variante_id: string | null;
  nombre_producto: string;
  talle: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
};

type IntentoPagoResponse = {
  id: string;
  estado: IntentoPagoEstado;
  canal_pago: string;
  external_id: string | null;
  preference_id?: string | null;
   notificado_en?: string | null;
   ultimo_evento_tipo?: string | null;
   ultimo_evento_payload?: unknown;
  creado_en: string;
  actualizado_en: string;
};

type ApiOk = {
  pedido: {
    pedido_id: string;
    estado: PedidoEstado;
    total: number;
    expira_en: string;
    bloqueado_por_stock: boolean;
    intento_pago_consolidado_id: string | null;
    direccion_envio_snapshot: unknown;
    creado_en: string;
    actualizado_en: string;
    items: PedidoItemResponse[];
    intento_pago: IntentoPagoResponse | null;
    intentos_pago: IntentoPagoResponse[];
  };
};

type ApiErr = { error: string };

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

  const rawId = req.query.id;
  const pedidoId = Array.isArray(rawId) ? rawId[0] : rawId;
  const pedidoIdTrimmed = typeof pedidoId === "string" ? pedidoId.trim() : "";

  if (!pedidoIdTrimmed) {
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

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();

    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from("usuario")
      .select("empresa_id, rol")
      .eq("supabase_uid", userData.user.id)
      .maybeSingle();

    if (perfilErr) {
      console.error("[GET /api/panel/pedidos/:id] perfilErr", perfilErr);
      return res.status(500).json({ error: "internal_error" });
    }

    if (!perfil?.empresa_id) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (!perfil.rol || !["admin", "staff"].includes(perfil.rol)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const { data: pedido, error: pedidoErr } = await supabaseAdmin
      .from("pedido")
      .select(
        `
          id,
          empresa_id,
          estado,
          total,
          expira_en,
          bloqueado_por_stock,
          intento_pago_consolidado_id,
          direccion_envio_snapshot,
          creado_en,
          actualizado_en
        `
      )
      .eq("id", pedidoIdTrimmed)
      .eq("empresa_id", perfil.empresa_id)
      .maybeSingle();

    if (pedidoErr) {
      console.error("[GET /api/panel/pedidos/:id] pedidoErr", pedidoErr);
      return res.status(500).json({ error: "internal_error" });
    }

    if (!pedido) {
      return res.status(404).json({ error: "pedido_no_encontrado" });
    }

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("pedido_item")
      .select(
        `
          producto_id,
          variante_id,
          nombre_producto,
          talle,
          precio_unitario,
          cantidad,
          subtotal
        `
      )
      .eq("pedido_id", pedido.id)
      .eq("empresa_id", pedido.empresa_id);

    if (itemsErr) {
      console.error("[GET /api/panel/pedidos/:id] itemsErr", itemsErr);
    }

    const { data: intentosPago, error: intentoPagoErr } = await supabaseAdmin
      .from("intento_pago")
      .select(
        "id, estado, canal_pago, external_id, preference_id, notificado_en, ultimo_evento_tipo, ultimo_evento_payload, creado_en, actualizado_en"
      )
      .eq("pedido_id", pedido.id)
      .eq("empresa_id", pedido.empresa_id)
      .order("creado_en", { ascending: false })
      .order("id", { ascending: false });

    if (intentoPagoErr) {
      console.error(
        "[GET /api/panel/pedidos/:id] intentoPagoErr",
        intentoPagoErr
      );
    }

    const intentosPagoRows = !intentoPagoErr ? intentosPago ?? [] : [];
    const intentoPago = intentosPagoRows[0] ?? null;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Panel-Only", "1");
    res.setHeader("X-Auth-Mode", "bearer_or_cookie");

    return res.status(200).json({
      pedido: {
        pedido_id: pedido.id,
        estado: pedido.estado as PedidoEstado,
        total: Number(pedido.total),
        expira_en: pedido.expira_en,
        bloqueado_por_stock: Boolean(pedido.bloqueado_por_stock),
        intento_pago_consolidado_id: pedido.intento_pago_consolidado_id ?? null,
        direccion_envio_snapshot: pedido.direccion_envio_snapshot,
        creado_en: pedido.creado_en,
        actualizado_en: pedido.actualizado_en,
        items: (itemsErr ? [] : items ?? []).map((item) => ({
          producto_id: item.producto_id,
          variante_id: item.variante_id,
          nombre_producto: item.nombre_producto,
          talle: item.talle,
          precio_unitario: Number(item.precio_unitario),
          cantidad: Number(item.cantidad),
          subtotal: Number(item.subtotal),
        })),
        intento_pago: !intentoPagoErr && intentoPago
          ? {
              id: intentoPago.id,
              estado: intentoPago.estado as IntentoPagoEstado,
              canal_pago: intentoPago.canal_pago,
              external_id: intentoPago.external_id,
              preference_id: intentoPago.preference_id ?? null,
              notificado_en: intentoPago.notificado_en ?? null,
              ultimo_evento_tipo: intentoPago.ultimo_evento_tipo ?? null,
              ultimo_evento_payload: intentoPago.ultimo_evento_payload ?? null,
              creado_en: intentoPago.creado_en,
              actualizado_en: intentoPago.actualizado_en,
            }
          : null,
        intentos_pago: intentosPagoRows.map((intento) => ({
          id: intento.id,
          estado: intento.estado as IntentoPagoEstado,
          canal_pago: intento.canal_pago,
          external_id: intento.external_id,
          preference_id: intento.preference_id ?? null,
          notificado_en: intento.notificado_en ?? null,
          ultimo_evento_tipo: intento.ultimo_evento_tipo ?? null,
          ultimo_evento_payload: intento.ultimo_evento_payload ?? null,
          creado_en: intento.creado_en,
          actualizado_en: intento.actualizado_en,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/panel/pedidos/:id] unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
