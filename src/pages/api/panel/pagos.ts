import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimitHeaders, checkRateLimit } from "../../../lib/apiSecurity";
import {
  authorizePanelRequest,
  createPanelServiceClient,
} from "../../../lib/panelAuthorization";

type PagosEstado = "activo" | "inactivo";

type PagosRow = {
  live_mode: boolean;
  estado: PagosEstado;
};

type ApiOk = { configurado: boolean; live_mode: boolean | null; estado: PagosEstado | null };
type ApiErr = { error: string };
type ApiResponse = NextApiResponse<ApiOk | ApiErr>;

const PAGOS_COLUMNS = "live_mode, estado";

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function logFailure(operation: string, error: unknown): void {
  console.error({ scope: "panel.pagos.read", operation, errorCode: "query_failed" });
  void error;
}

export default async function handler(req: NextApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: "api:panel:pagos:read",
    limit: 60,
    windowMs: 60_000,
  });
  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (hasOwn(req.query, "empresa_id") || (isRecord(req.body) && hasOwn(req.body, "empresa_id"))) {
    return res.status(400).json({ error: "legacy_tenant_input" });
  }

  const authorization = await authorizePanelRequest(req, "payments.access");
  if (authorization.ok === false) {
    return res.status(authorization.status).json({ error: authorization.error });
  }

  try {
    const serviceClient = createPanelServiceClient();
    const { data, error } = await serviceClient
      .from("empresa_mercadopago")
      .select(PAGOS_COLUMNS)
      .eq("empresa_id", authorization.principal.empresaId)
      .maybeSingle<PagosRow>();

    if (error) {
      logFailure("query", error);
      return res.status(500).json({ error: "internal_error" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(
      data
        ? { configurado: true, live_mode: data.live_mode, estado: data.estado }
        : { configurado: false, live_mode: null, estado: null },
    );
  } catch (error) {
    logFailure("unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
