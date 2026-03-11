import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {

    const { usuario_id, empresa_id, direccion_envio_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "items_required" });
    }

const { data, error } = await supabaseServer.rpc("crear_pedido_con_items", {
  p_usuario_id: usuario_id,
  p_empresa_id: empresa_id,
  p_direccion_envio_id: direccion_envio_id,
  p_items: items
});

if (error) {
  console.error("RPC ERROR:", error);
  return res.status(500).json({
    error: "pedido_creation_failed",
    details: error
  });
}

    return res.status(200).json({
      pedido_id: data
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "unexpected_error"
    });

  }
}