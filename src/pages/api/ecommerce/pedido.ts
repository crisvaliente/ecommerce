import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  usuario_id_required: 400,
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
  variantes_no_soportadas_en_v1: 400,
};

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

  try {
    const { usuario_id, empresa_id, direccion_envio_id, items } = req.body ?? {};

    if (!usuario_id) {
      return res.status(400).json({ error: "usuario_id_required" });
    }

    if (!empresa_id) {
      return res.status(400).json({ error: "empresa_id_required" });
    }

    let direccionEnvioId =
      typeof direccion_envio_id === "string" && direccion_envio_id.trim().length > 0
        ? direccion_envio_id.trim()
        : null;

    if (!direccionEnvioId) {
      direccionEnvioId = await resolveDireccionEnvioId(usuario_id);
    }

    if (!direccionEnvioId) {
      return res.status(DOMAIN_ERROR_STATUS.direccion_envio_no_disponible).json({
        error: "direccion_envio_no_disponible",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items_required" });
    }

    const { data, error } = await supabaseServer.rpc("crear_pedido_con_items", {
      p_usuario_id: usuario_id,
      p_empresa_id: empresa_id,
      p_direccion_envio_id: direccionEnvioId,
      p_items: items,
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
