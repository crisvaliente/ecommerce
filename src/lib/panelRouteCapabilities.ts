import {
  hasPanelCapability,
  type PanelCapability,
  type PanelRole,
} from "./panelCapabilities";

const CAPABILITY_BY_PATHNAME: Readonly<Record<string, PanelCapability>> = Object.freeze({
  "/panel": "panel.enter",
  "/panel/payments": "payments.access",
  "/panel/productos": "catalog.operate",
  "/panel/productos/nuevo": "catalog.operate",
  "/panel/productos/[id]": "catalog.operate",
  "/panel/categorias": "catalog.operate",
  "/panel/pedidos": "orders.operate",
  "/panel/pedidos/[id]": "orders.operate",
});

type ObservedSessionUser = { id?: unknown } | null | undefined;
type ObservedDbUser = {
  supabase_uid?: unknown;
  rol?: unknown;
  empresa_id?: unknown;
} | null | undefined;

type PanelAdmissionInput = {
  loading: unknown;
  pathname: unknown;
  sessionUser: ObservedSessionUser;
  dbUser: ObservedDbUser;
};

export type PanelAdmission =
  | { kind: "allow" }
  | { kind: "loading" }
  | { kind: "redirect"; destination: "/auth/login" | "/auth/no-autorizado" | "/auth/registroempresa" };

const noAuthorization = (): PanelAdmission => ({
  kind: "redirect",
  destination: "/auth/no-autorizado",
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOwnString(record: object, key: string): string | null {
  if (!Object.hasOwn(record, key)) return null;
  const value = (record as Record<string, unknown>)[key];
  return isNonEmptyString(value) ? value : null;
}

export function panelCapabilityForPathname(pathname: unknown): PanelCapability | null {
  if (typeof pathname !== "string" || !Object.hasOwn(CAPABILITY_BY_PATHNAME, pathname)) {
    return null;
  }
  return CAPABILITY_BY_PATHNAME[pathname] ?? null;
}

export function decidePanelAdmission({
  loading,
  pathname,
  sessionUser,
  dbUser,
}: PanelAdmissionInput): PanelAdmission {
  if (loading === true) return { kind: "loading" };
  if (loading !== false) return noAuthorization();
  if (sessionUser === null || sessionUser === undefined) {
    return { kind: "redirect", destination: "/auth/login" };
  }
  if (typeof sessionUser !== "object") return noAuthorization();
  const sessionUid = hasOwnString(sessionUser, "id");
  if (!sessionUid) return noAuthorization();
  if (dbUser === null || dbUser === undefined || typeof dbUser !== "object") {
    return noAuthorization();
  }

  const profileUid = hasOwnString(dbUser, "supabase_uid");
  const role = hasOwnString(dbUser, "rol");
  if (!profileUid || !role || profileUid !== sessionUid) return noAuthorization();

  const capability = panelCapabilityForPathname(pathname);
  if (!capability || !hasPanelCapability(role as PanelRole, capability)) {
    return noAuthorization();
  }

  if (!Object.hasOwn(dbUser, "empresa_id") || dbUser.empresa_id === null || dbUser.empresa_id === undefined) {
    return { kind: "redirect", destination: "/auth/registroempresa" };
  }
  if (!isNonEmptyString(dbUser.empresa_id)) return noAuthorization();

  return { kind: "allow" };
}
