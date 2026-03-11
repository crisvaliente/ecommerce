import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  usuario_id_required: 400,
  empresa_id_required: 400,
  direccion_envio_id_required: 400,
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

    if (!direccion_envio_id) {
      return res.status(400).json({ error: "direccion_envio_id_required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items_required" });
    }

    const { data, error } = await supabaseServer.rpc("crear_pedido_con_items", {
      p_usuario_id: usuario_id,
      p_empresa_id: empresa_id,
      p_direccion_envio_id: direccion_envio_id,
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