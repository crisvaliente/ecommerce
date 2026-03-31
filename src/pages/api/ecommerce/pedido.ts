import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../../lib/supabaseServer";

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  empresa_id_required: 400,
  direccion_envio_id_required: 400,
  direccion_envio_no_disponible: 409,
  items_required: 400,
  items_must_be_array: 400,
  pedido_sin_items: 400,
  producto_id_required: 400,
  cantidad_required: 400,
  cantidad_invalida: 400,
  direccion_no_existe: 400,
  direccion_no_pertenece_al_usuario: 400,
  producto_no_existe: 400,
  producto_no_pertenece_a_empresa: 400,
  variante_id_required: 400,
  variante_no_pertenece_al_producto: 400,
  variante_inactiva: 400,
  variantes_no_soportadas_en_v1: 400,
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getErrorMessage(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return null;
}

function getAccessToken(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;

  if (auth && typeof auth === "string") {
    const match = auth.match(/^Bearer\s+(.+)$/i);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const cookie = req.headers.cookie;

  if (!cookie || typeof cookie !== "string") {
    return null;
  }

  const match = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

async function resolveDireccionEnvioId(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("direccion_usuario")
    .select("id")
    .eq("usuario_id", usuarioId)
    .order("fecha_creacion", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  try {
    const { empresa_id, direccion_envio_id, items } = req.body ?? {};

    if (!empresa_id) {
      return res.status(400).json({ error: "empresa_id_required" });
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

    const usuarioId = usuarioRow.id;

    let direccionEnvioId =
      typeof direccion_envio_id === "string" && direccion_envio_id.trim().length > 0
        ? direccion_envio_id.trim()
        : null;

    if (!direccionEnvioId) {
      direccionEnvioId = await resolveDireccionEnvioId(usuarioId);
    }

    if (!direccionEnvioId) {
      return res.status(DOMAIN_ERROR_STATUS.direccion_envio_no_disponible).json({
        error: "direccion_envio_no_disponible",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items_required" });
    }

    const rpcItems = items.map((item: any) => ({
      ...item,
      variante_id:
        typeof item?.variante_id === "string" && item.variante_id.trim().length > 0
          ? item.variante_id.trim()
          : null,
    }));

    const { data, error } = await supabaseServer.rpc("crear_pedido_con_items", {
      p_usuario_id: usuarioId,
      p_empresa_id: empresa_id,
      p_direccion_envio_id: direccionEnvioId,
      p_items: rpcItems,
    });

    if (error) {
      const message = getErrorMessage(error);

      if (message && DOMAIN_ERROR_STATUS[message]) {
        return res.status(DOMAIN_ERROR_STATUS[message]).json({
          error: message,
        });
      }

      console.error("RPC ERROR:", error);

      return res.status(500).json({
        error: "pedido_creation_failed",
      });
    }

    return res.status(200).json({
      pedido_id: data,
    });
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);

    return res.status(500).json({
      error: "unexpected_error",
    });
  }
}
