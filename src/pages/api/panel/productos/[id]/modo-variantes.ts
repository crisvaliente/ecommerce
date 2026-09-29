import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  hasBearerAuthorization,
  hasSessionAccessCookie,
  validateTrustedOrigin,
} from "../../../../../lib/apiSecurity";
import {
  authorizePanelRequest,
  createPanelServiceClient,
} from "../../../../../lib/panelAuthorization";

type SwitchResultRow = {
  ok: boolean;
  codigo_resultado: string;
  variante_id: string | null;
  stock_migrado: number;
};

type ApiOk = { codigo_resultado: string; stock_migrado: number; estado: string };
type ApiErr = { error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code.slice(0, 80);
  }

  return error instanceof Error ? error.name.slice(0, 80) : "unknown_error";
}

function logFailure(operation: string, error: unknown): void {
  console.error({
    scope: "panel.productos.variant_mode",
    operation,
    errorCode: safeErrorCode(error),
  });
}

/**
 * Switches a simple product to variant mode through pasar_producto_a_variantes,
 * which moves its stock into a single variant in one transaction. A product in
 * a pending order is rejected by the database with SQLSTATE 55006.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: "api:panel:productos:write",
    limit: 30,
    windowMs: 60_000,
  });
  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (Object.prototype.hasOwnProperty.call(req.query, "empresa_id")) {
    return res.status(400).json({ error: "legacy_tenant_input" });
  }

  const rawId = req.query.id;
  const productoId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (typeof productoId !== "string" || !UUID_RE.test(productoId)) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const originValidation = validateTrustedOrigin(req, {
    allowWithoutOrigin: hasBearerAuthorization(req) || !hasSessionAccessCookie(req),
  });
  if (originValidation.ok === false) {
    return res.status(403).json({ error: originValidation.reason });
  }

  const authorization = await authorizePanelRequest(req, "catalog.operate");
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error });
  }

  const empresaId = authorization.principal.empresaId;
  res.setHeader("Cache-Control", "no-store");

  try {
    const serviceClient = createPanelServiceClient();
    const { data, error } = await serviceClient.rpc("pasar_producto_a_variantes", {
      p_producto_id: productoId,
      p_empresa_id: empresaId,
    });

    if (error) {
      if (safeErrorCode(error) === "55006") {
        return res.status(409).json({ error: "producto_en_pedido_activo" });
      }
      logFailure("rpc", error);
      return res.status(500).json({ error: "internal_error" });
    }

    const row = (Array.isArray(data) ? data[0] : null) as SwitchResultRow | null;
    if (!row || typeof row.ok !== "boolean") {
      logFailure("invalid_rpc_result", null);
      return res.status(500).json({ error: "internal_error" });
    }

    if (!row.ok) {
      return res.status(404).json({ error: "producto_no_encontrado" });
    }

    // Switching can return a published product to draft (producto_auto_draft_on_update).
    const { data: producto, error: estadoError } = await serviceClient
      .from("producto")
      .select("estado")
      .eq("id", productoId)
      .eq("empresa_id", empresaId)
      .single();

    if (estadoError || !producto) {
      logFailure("estado_lookup", estadoError);
      return res.status(500).json({ error: "internal_error" });
    }

    return res.status(200).json({
      codigo_resultado: row.codigo_resultado,
      stock_migrado: row.stock_migrado,
      estado: producto.estado,
    });
  } catch (error) {
    logFailure("unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
