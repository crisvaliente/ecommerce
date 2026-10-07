import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  hasBearerAuthorization,
  hasSessionAccessCookie,
  validateTrustedOrigin,
} from "../../../lib/apiSecurity";
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

type CategoriaInput = {
  nombre: string;
  slug: string | null;
  descripcion: string | null;
  orden: number | null;
};

type ApiOk = { items: CategoriaRow[] } | { item: CategoriaRow };
type ApiErr = { error: string };
type ApiResponse = NextApiResponse<ApiOk | ApiErr>;

const CATEGORIA_COLUMNS = "id, nombre, slug, descripcion, orden";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INPUT_KEYS = new Set(["nombre", "slug", "descripcion", "orden"]);
const MAX_TEXT_LENGTH = 255;
const MAX_DESCRIPCION_LENGTH = 2000;
const MAX_ORDEN = 2_147_483_647;

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code.slice(0, 80);
  }

  return error instanceof Error ? error.name.slice(0, 80) : "unknown_error";
}

function logFailure(action: string, operation: string, error: unknown): void {
  console.error({
    scope: `panel.categorias.${action}`,
    operation,
    errorCode: safeErrorCode(error),
  });
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return undefined;
  return trimmed || null;
}

/** Only sent fields are returned: POST requires nombre, PATCH at least one field. */
function parseCategoriaInput(body: unknown, partial: boolean): Partial<CategoriaInput> | null {
  if (!isRecord(body)) return null;
  const keys = Object.keys(body);
  if (
    keys.some((key) => !INPUT_KEYS.has(key)) ||
    (partial ? keys.length === 0 : !hasOwn(body, "nombre"))
  ) {
    return null;
  }

  const input: Partial<CategoriaInput> = {};
  if (hasOwn(body, "nombre")) {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > MAX_TEXT_LENGTH) return null;
    input.nombre = nombre;
  }
  if (hasOwn(body, "slug")) {
    const slug = optionalText(body.slug, MAX_TEXT_LENGTH);
    if (slug === undefined) return null;
    input.slug = slug;
  }
  if (hasOwn(body, "descripcion")) {
    const descripcion = optionalText(body.descripcion, MAX_DESCRIPCION_LENGTH);
    if (descripcion === undefined) return null;
    input.descripcion = descripcion;
  }
  if (hasOwn(body, "orden")) {
    const orden = body.orden ?? null;
    if (orden !== null && (!Number.isInteger(orden) || Math.abs(orden as number) > MAX_ORDEN)) {
      return null;
    }
    input.orden = orden as number | null;
  }

  return input;
}

function readCategoriaId(req: NextApiRequest): string | null {
  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

function writeFailure(res: ApiResponse, action: string, error: unknown) {
  const code = safeErrorCode(error);
  if (code === "23505") return res.status(409).json({ error: "categoria_duplicada" });
  if (code === "23503") return res.status(409).json({ error: "categoria_en_uso" });

  logFailure(action, "write", error);
  return res.status(500).json({ error: "internal_error" });
}

async function listCategorias(req: NextApiRequest, res: ApiResponse) {
  const rateLimit = checkRateLimit(req, {
    key: "api:panel:categorias:list",
    limit: 60,
    windowMs: 60_000,
  });
  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (hasOwn(req.query, "empresa_id")) {
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
      .select(CATEGORIA_COLUMNS)
      .eq("empresa_id", authorization.principal.empresaId)
      .order("orden", { ascending: true, nullsFirst: true })
      .returns<CategoriaRow[]>();

    if (error) {
      logFailure("list", "query", error);
      return res.status(500).json({ error: "internal_error" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ items: data ?? [] });
  } catch (error) {
    logFailure("list", "unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function writeCategoria(req: NextApiRequest, res: ApiResponse) {
  const action = req.method === "POST" ? "create" : req.method === "PATCH" ? "update" : "delete";
  const rateLimit = checkRateLimit(req, {
    key: "api:panel:categorias:write",
    limit: 30,
    windowMs: 60_000,
  });
  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.ok) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  if (hasOwn(req.query, "empresa_id") || (isRecord(req.body) && hasOwn(req.body, "empresa_id"))) {
    return res.status(400).json({ error: "legacy_tenant_input" });
  }

  const categoriaId = action === "create" ? null : readCategoriaId(req);
  const input = action === "delete" ? null : parseCategoriaInput(req.body, action === "update");
  if ((action !== "create" && !categoriaId) || (action !== "delete" && !input)) {
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
    const categorias = createPanelServiceClient().from("categoria");

    if (action === "create") {
      const { data, error } = await categorias
        .insert({ empresa_id: empresaId, ...input })
        .select(CATEGORIA_COLUMNS)
        .single<CategoriaRow>();
      if (error) return writeFailure(res, action, error);
      return res.status(201).json({ item: data });
    }

    if (action === "update") {
      const { data, error } = await categorias
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", categoriaId)
        .eq("empresa_id", empresaId)
        .select(CATEGORIA_COLUMNS)
        .maybeSingle<CategoriaRow>();
      if (error) return writeFailure(res, action, error);
      if (!data) return res.status(404).json({ error: "categoria_no_encontrada" });
      return res.status(200).json({ item: data });
    }

    const { data, error } = await categorias
      .delete()
      .eq("id", categoriaId)
      .eq("empresa_id", empresaId)
      .select("id")
      .maybeSingle();
    if (error) return writeFailure(res, action, error);
    if (!data) return res.status(404).json({ error: "categoria_no_encontrada" });
    return res.status(204).end();
  } catch (error) {
    logFailure(action, "unexpected", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

export default async function handler(req: NextApiRequest, res: ApiResponse) {
  if (req.method === "GET") return listCategorias(req, res);
  if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
    return writeCategoria(req, res);
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
