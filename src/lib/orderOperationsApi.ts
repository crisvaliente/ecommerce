type PanelRole = "admin" | "staff";
type OperationalState =
  | "pendiente_pago"
  | "pagado"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

type AuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 500;
  error: string;
};

type AuthorizationSuccess = {
  ok: true;
  userId: string;
  empresaId: string;
  role: PanelRole;
  supabaseAdmin: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{
      data: unknown;
      error: unknown;
    }>;
  };
};

type RequestLike = {
  method?: string;
  query: { id?: string | string[] };
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (payload: { error: string } | { transition: TransitionResult }) => unknown;
};

type TransitionResult = {
  ok: boolean;
  codigo_resultado: string;
  pedido_id: string;
  estado_anterior: OperationalState | null;
  estado_final: OperationalState | null;
  evento_id: string | null;
  idempotente: boolean;
};

type Dependencies = {
  authorizePanelAccess: (
    req: RequestLike,
  ) => Promise<AuthorizationFailure | AuthorizationSuccess>;
  applyRateLimitHeaders: (res: ResponseLike, result: RateLimitResult) => void;
  checkRateLimit: (req: RequestLike, options: RateLimitOptions) => RateLimitResult;
  hasBearerAuthorization: (req: RequestLike) => boolean;
  hasSessionAccessCookie: (req: RequestLike) => boolean;
  validateTrustedOrigin: (
    req: RequestLike,
    options: { allowWithoutOrigin: boolean },
  ) => { ok: true } | { ok: false; reason: string };
  getHandler: (req: RequestLike, res: ResponseLike) => Promise<unknown>;
};

type RateLimitOptions = { key: string; limit: number; windowMs: number };
type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(["expected_state", "target_state", "motivo"]);
const ALLOWED_TRANSITIONS = new Set([
  "pagado:en_preparacion",
  "en_preparacion:enviado",
  "enviado:entregado",
  "pendiente_pago:cancelado",
]);
const OPERATIONAL_STATES = new Set<OperationalState>([
  "pendiente_pago",
  "pagado",
  "en_preparacion",
  "enviado",
  "entregado",
  "cancelado",
]);
const SAFE_ERROR_CODE_RE = /^[A-Za-z0-9_]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(body: unknown):
  | { ok: true; expectedState: OperationalState; targetState: OperationalState; motivo: string | null }
  | { ok: false } {
  if (!isRecord(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false };
  }

  const expectedState = body.expected_state;
  const targetState = body.target_state;
  const motivo = body.motivo;

  if (
    typeof expectedState !== "string" ||
    !OPERATIONAL_STATES.has(expectedState as OperationalState) ||
    typeof targetState !== "string" ||
    !OPERATIONAL_STATES.has(targetState as OperationalState) ||
    !ALLOWED_TRANSITIONS.has(`${expectedState}:${targetState}`) ||
    (motivo !== undefined && typeof motivo !== "string")
  ) {
    return { ok: false };
  }

  const normalizedMotivo = typeof motivo === "string" ? motivo.trim() : "";
  if (normalizedMotivo.length > 500) {
    return { ok: false };
  }

  return {
    ok: true,
    expectedState: expectedState as OperationalState,
    targetState: targetState as OperationalState,
    motivo: normalizedMotivo || null,
  };
}

function readTransitionResult(data: unknown): TransitionResult | null {
  const row = Array.isArray(data) ? data[0] : null;
  if (
    !isRecord(row) ||
    typeof row.ok !== "boolean" ||
    typeof row.codigo_resultado !== "string" ||
    typeof row.pedido_id !== "string" ||
    (row.estado_anterior !== null &&
      (typeof row.estado_anterior !== "string" ||
        !OPERATIONAL_STATES.has(row.estado_anterior as OperationalState))) ||
    (row.estado_final !== null &&
      (typeof row.estado_final !== "string" ||
        !OPERATIONAL_STATES.has(row.estado_final as OperationalState))) ||
    (row.evento_id !== null && typeof row.evento_id !== "string") ||
    typeof row.idempotente !== "boolean"
  ) {
    return null;
  }

  return {
    ok: row.ok,
    codigo_resultado: row.codigo_resultado,
    pedido_id: row.pedido_id,
    estado_anterior: row.estado_anterior as OperationalState | null,
    estado_final: row.estado_final as OperationalState | null,
    evento_id: row.evento_id as string | null,
    idempotente: row.idempotente,
  };
}

function safeErrorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === "string" && SAFE_ERROR_CODE_RE.test(error.code)) {
    return error.code;
  }
  return "unknown_error";
}

function logFailure(operation: string, error: unknown): void {
  console.error({
    scope: "panel.pedidos.operation",
    operation,
    errorCode: safeErrorCode(error),
  });
}

function domainFailure(res: ResponseLike, code: string) {
  if (code === "pedido_no_encontrado" || code === "empresa_no_coincide") {
    return res.status(404).json({ error: "pedido_no_encontrado" });
  }
  if (
    code === "expected_state_stale" ||
    code === "estado_terminal" ||
    code === "transicion_no_permitida" ||
    code === "cancelacion_pago_en_vuelo"
  ) {
    return res.status(409).json({ error: code });
  }
  logFailure("unexpected_rpc_result", { code });
  return res.status(500).json({ error: "internal_error" });
}

export function createOrderDetailHandler(dependencies: Dependencies) {
  return async function orderDetailHandler(req: RequestLike, res: ResponseLike) {
    if (req.method === "GET") {
      return dependencies.getHandler(req, res);
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const rateLimit = dependencies.checkRateLimit(req, {
      key: "api:panel:pedidos:operation",
      limit: 30,
      windowMs: 60_000,
    });
    dependencies.applyRateLimitHeaders(res, rateLimit);
    if (!rateLimit.ok) {
      return res.status(429).json({ error: "rate_limit_exceeded" });
    }

    const rawId = req.query.id;
    const pedidoId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (typeof pedidoId !== "string" || !UUID_RE.test(pedidoId)) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const payload = parsePayload(req.body);
    if (!payload.ok) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const originValidation = dependencies.validateTrustedOrigin(req, {
      allowWithoutOrigin:
        dependencies.hasBearerAuthorization(req) ||
        !dependencies.hasSessionAccessCookie(req),
    });
    if (originValidation.ok === false) {
      return res.status(403).json({ error: originValidation.reason });
    }

    const authorization = await dependencies.authorizePanelAccess(req);
    if (authorization.ok === false) {
      return res.status(authorization.status).json({ error: authorization.error });
    }

    if (payload.targetState === "cancelado" && authorization.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const { data, error } = await authorization.supabaseAdmin.rpc(
        "transicionar_pedido_operacional",
        {
          p_pedido_id: pedidoId,
          p_empresa_id: authorization.empresaId,
          p_expected_state: payload.expectedState,
          p_target_state: payload.targetState,
          p_actor_id: authorization.userId,
          p_motivo: payload.motivo,
        },
      );

      if (error) {
        logFailure("transition_rpc", error);
        return res.status(500).json({ error: "internal_error" });
      }

      const transition = readTransitionResult(data);
      if (!transition) {
        logFailure("invalid_rpc_response", null);
        return res.status(500).json({ error: "internal_error" });
      }

      if (!transition.ok) {
        return domainFailure(res, transition.codigo_resultado);
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Panel-Only", "1");
      res.setHeader("X-Auth-Mode", "bearer_or_cookie");
      return res.status(200).json({ transition });
    } catch (error) {
      logFailure("unexpected_failure", error);
      return res.status(500).json({ error: "internal_error" });
    }
  };
}
