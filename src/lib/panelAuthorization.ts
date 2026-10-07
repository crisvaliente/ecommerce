import type { NextApiRequest } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PANEL_ROLES,
  hasPanelCapability,
  type PanelCapability,
  type PanelRole,
} from "./panelCapabilities.ts";

export type PanelPrincipal = {
  authUserId: string;
  profileId: string;
  role: "admin" | "staff";
  empresaId: string;
};

type PanelAuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 500;
  error: "unauthorized" | "forbidden" | "internal_error";
};

type PanelAuthorizationSuccess = { ok: true; principal: PanelPrincipal };
export type PanelAuthorizationResult = PanelAuthorizationSuccess | PanelAuthorizationFailure;

type ClientFactory = (
  url: string,
  key: string,
  options: Parameters<typeof createClient>[2],
) => SupabaseClient;

export type PanelAuthorizationDependencies = {
  createClient: ClientFactory;
  readPublicEnv: () => { supabaseUrl?: string; supabaseAnonKey?: string };
  readServiceRoleKey: () => string | undefined;
  logError?: (event: { scope: string; operation: string; errorCode: string }) => void;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ERROR_CODE_RE = /^[A-Za-z0-9_]{1,64}$/;
const panelRoleSet: ReadonlySet<string> = new Set(PANEL_ROLES);

const defaultDependencies: PanelAuthorizationDependencies = {
  createClient,
  readPublicEnv: () => ({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }),
  readServiceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function failure(
  status: PanelAuthorizationFailure["status"],
  error: PanelAuthorizationFailure["error"],
): PanelAuthorizationFailure {
  return { ok: false, status, error };
}

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown; name?: unknown }).code ??
      (error as { name?: unknown }).name;
    if (typeof code === "string" && SAFE_ERROR_CODE_RE.test(code)) return code;
  }
  return "unknown_error";
}

function reportOperationalFailure(
  dependencies: PanelAuthorizationDependencies,
  operation: string,
  error: unknown,
): void {
  const event = {
    scope: "panel.authorization",
    operation,
    errorCode: safeErrorCode(error),
  };
  if (dependencies.logError) dependencies.logError(event);
  else console.error(event);
}

function parseAccessToken(req: NextApiRequest): string | null {
  const authorization = req.headers.authorization;
  if (authorization !== undefined) {
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length);
    return token && token.trim() === token && !/\s/.test(token) ? token : null;
  }

  const cookie = req.headers.cookie;
  if (typeof cookie !== "string") return null;
  const match = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    const token = decodeURIComponent(match[1]).trim();
    return token || null;
  } catch {
    return null;
  }
}

function isCredentialRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return status === 400 || status === 401 || status === 403;
}

function isCanonicalProfile(value: unknown): value is {
  id: string;
  empresa_id: string | null;
  rol: PanelRole;
  onboarding: boolean;
} {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    UUID_RE.test(row.id) &&
    (row.empresa_id === null || (typeof row.empresa_id === "string" && UUID_RE.test(row.empresa_id))) &&
    typeof row.rol === "string" &&
    panelRoleSet.has(row.rol) &&
    typeof row.onboarding === "boolean"
  );
}

export function createPanelAuthorization(dependencies: PanelAuthorizationDependencies) {
  async function authorizePanelRequest(
    req: NextApiRequest,
    requiredCapability: PanelCapability,
    requestedEmpresaId?: string,
  ): Promise<PanelAuthorizationResult> {
    const token = parseAccessToken(req);
    if (!token) return failure(401, "unauthorized");

    let publicEnv: ReturnType<PanelAuthorizationDependencies["readPublicEnv"]>;
    try {
      publicEnv = dependencies.readPublicEnv();
    } catch (error) {
      reportOperationalFailure(dependencies, "public_config", error);
      return failure(500, "internal_error");
    }
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
      reportOperationalFailure(dependencies, "public_config", { code: "missing_config" });
      return failure(500, "internal_error");
    }

    try {
      const callerClient = dependencies.createClient(
        publicEnv.supabaseUrl,
        publicEnv.supabaseAnonKey,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );

      const { data: userData, error: userError } = await callerClient.auth.getUser();
      if (userError) {
        if (isCredentialRejection(userError)) return failure(401, "unauthorized");
        reportOperationalFailure(dependencies, "auth_user", userError);
        return failure(500, "internal_error");
      }
      if (!userData.user || !UUID_RE.test(userData.user.id)) return failure(401, "unauthorized");

      const { data: profiles, error: profileError } = await callerClient
        .from("usuario")
        .select("id, empresa_id, rol, onboarding")
        .eq("supabase_uid", userData.user.id)
        .limit(2);
      if (profileError) {
        reportOperationalFailure(dependencies, "profile_lookup", profileError);
        return failure(500, "internal_error");
      }
      if (!Array.isArray(profiles) || profiles.length !== 1 || !isCanonicalProfile(profiles[0])) {
        return failure(403, "forbidden");
      }

      const profile = profiles[0];
      if ((profile.rol === "admin" || profile.rol === "staff") &&
          (!profile.empresa_id || profile.onboarding)) {
        return failure(403, "forbidden");
      }
      if (profile.rol === "cliente" && profile.empresa_id === null && !profile.onboarding) {
        return failure(403, "forbidden");
      }

      if (profile.empresa_id) {
        const { data: companies, error: companyError } = await callerClient
          .from("empresa")
          .select("id")
          .eq("id", profile.empresa_id)
          .limit(2);
        if (companyError) {
          reportOperationalFailure(dependencies, "company_lookup", companyError);
          return failure(500, "internal_error");
        }
        if (!Array.isArray(companies) || companies.length !== 1 ||
            companies[0]?.id !== profile.empresa_id) {
          return failure(403, "forbidden");
        }
      }

      if (!hasPanelCapability(profile.rol, requiredCapability)) return failure(403, "forbidden");
      if (requestedEmpresaId !== undefined && requestedEmpresaId !== profile.empresa_id) {
        return failure(403, "forbidden");
      }

      return {
        ok: true,
        principal: {
          authUserId: userData.user.id,
          profileId: profile.id,
          role: profile.rol as "admin" | "staff",
          empresaId: profile.empresa_id as string,
        },
      };
    } catch (error) {
      reportOperationalFailure(dependencies, "unexpected_failure", error);
      return failure(500, "internal_error");
    }
  }

  function createPanelServiceClient(): SupabaseClient {
    const { supabaseUrl } = dependencies.readPublicEnv();
    const serviceRoleKey = dependencies.readServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) throw new Error("panel_service_config_unavailable");
    return dependencies.createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return { authorizePanelRequest, createPanelServiceClient };
}

const panelAuthorization = createPanelAuthorization(defaultDependencies);
export const authorizePanelRequest = panelAuthorization.authorizePanelRequest;
export const createPanelServiceClient = panelAuthorization.createPanelServiceClient;
