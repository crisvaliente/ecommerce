import type { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimitHeaders, checkRateLimit } from "../../../lib/apiSecurity";
import {
  authorizePanelRequest,
  createPanelServiceClient,
} from "../../../lib/panelAuthorization";

type CategoriaRow = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  orden: number | null;
};

type ApiOk = { items: CategoriaRow[] };
type ApiErr = { error: string };

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code.slice(0, 80);
  }

  return error instanceof Error ? error.name.slice(0, 80) : "unknown_error";
}

function logFailure(operation: string, error: unknown): void {
  console.error({
    scope: "panel.categorias.list",
    operation,
    errorCode: safeErrorCode(error),
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rateLimit = checkRateLimit(req, {
    key: "api:panel:categorias:list",
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
    const { data, error } = await serviceClient
      .from("categoria")
      .select("id, nombre, slug, descripcion, orden")
      .eq("empresa_id", authorization.principal.empresaId)
      .order("orden", { ascending: true, nullsFirst: true })
      .returns<CategoriaRow[]>();

    if (error) {
      logFailure("query", error);
      return res.status(500).json({ error: "internal_error" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ items: data ?? [] });
  } catch (error) {
    logFailure("unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
