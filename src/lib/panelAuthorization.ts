import type { NextApiRequest } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PanelRole = "admin" | "staff";

type PanelAuthorizationError =
  | "unauthorized"
  | "forbidden"
  | "server_misconfigured"
  | "internal_error";

type PanelAuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 500;
  error: PanelAuthorizationError;
};

type PanelAuthorizationSuccess = {
  ok: true;
  userId: string;
  empresaId: string;
  role: PanelRole;
  supabaseAdmin: SupabaseClient;
};

export type PanelAuthorizationResult =
  | PanelAuthorizationSuccess
  | PanelAuthorizationFailure;

function unauthorized(): PanelAuthorizationFailure {
  return { ok: false, status: 401, error: "unauthorized" };
}

function forbidden(): PanelAuthorizationFailure {
  return { ok: false, status: 403, error: "forbidden" };
}

function misconfigured(): PanelAuthorizationFailure {
  return { ok: false, status: 500, error: "server_misconfigured" };
}

function internalError(): PanelAuthorizationFailure {
  return { ok: false, status: 500, error: "internal_error" };
}

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function parseAccessToken(req: NextApiRequest):
  | { ok: true; token: string }
  | PanelAuthorizationFailure {
  const authorizationHeader = req.headers.authorization;

  if (authorizationHeader !== undefined) {
    const headerValue = getSingleHeaderValue(authorizationHeader);
    if (!headerValue || !headerValue.startsWith("Bearer ")) {
      return unauthorized();
    }

    const token = headerValue.slice("Bearer ".length);
    if (!token || token.trim() !== token || /\s/.test(token)) {
      return unauthorized();
    }

    return { ok: true, token };
  }

  const cookieHeader = getSingleHeaderValue(req.headers.cookie);
  if (!cookieHeader) {
    return unauthorized();
  }

  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (!match?.[1]) {
    return unauthorized();
  }

  try {
    const token = decodeURIComponent(match[1]).trim();
    if (!token) {
      return unauthorized();
    }

    return { ok: true, token };
  } catch {
    return unauthorized();
  }
}

function readPanelEnv():
  | {
      supabaseUrl: string;
      supabaseAnonKey: string;
      supabaseServiceRoleKey: string;
    }
  | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
  };
}

export async function authorizePanelAccess(
  req: NextApiRequest,
  requestedEmpresaId?: string
): Promise<PanelAuthorizationResult> {
  const tokenResult = parseAccessToken(req);
  if (tokenResult.ok === false) {
    return tokenResult;
  }

  const env = readPanelEnv();
  if (!env) {
    return misconfigured();
  }

  const supabaseAuth = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData.user) {
    return unauthorized();
  }

  const { data: profile, error: profileError } = await supabaseAuth
    .from("usuario")
    .select("empresa_id, rol")
    .eq("supabase_uid", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return internalError();
  }

  if (!profile?.empresa_id) {
    return forbidden();
  }

  if (profile.rol !== "admin" && profile.rol !== "staff") {
    return forbidden();
  }

  if (requestedEmpresaId !== undefined && requestedEmpresaId !== profile.empresa_id) {
    return forbidden();
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    ok: true,
    userId: userData.user.id,
    empresaId: profile.empresa_id,
    role: profile.rol as PanelRole,
    supabaseAdmin,
  };
}