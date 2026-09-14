export const PANEL_ROLES = Object.freeze([
  "admin",
  "staff",
  "cliente",
] as const);
export type PanelRole = (typeof PANEL_ROLES)[number];

export const PANEL_CAPABILITIES = Object.freeze([
  "panel.enter",
  "catalog.operate",
  "orders.operate",
  "orders.cancel",
  "payments.access",
  "companyRoles.admin",
] as const);
export type PanelCapability = (typeof PANEL_CAPABILITIES)[number];

export const CAPABILITIES_BY_ROLE = Object.freeze({
  admin: Object.freeze([
    "panel.enter",
    "catalog.operate",
    "orders.operate",
    "orders.cancel",
    "payments.access",
    "companyRoles.admin",
  ]),
  staff: Object.freeze([
    "panel.enter",
    "catalog.operate",
    "orders.operate",
  ]),
  cliente: Object.freeze([]),
} as const satisfies Record<PanelRole, readonly PanelCapability[]>);

const panelRoleSet: ReadonlySet<string> = new Set(PANEL_ROLES);
const panelCapabilitySet: ReadonlySet<string> = new Set(PANEL_CAPABILITIES);

export function hasPanelCapability(
  role: PanelRole,
  capability: PanelCapability,
): boolean {
  return (
    typeof role === "string" &&
    typeof capability === "string" &&
    panelRoleSet.has(role) &&
    panelCapabilitySet.has(capability) &&
    CAPABILITIES_BY_ROLE[role].some((allowed) => allowed === capability)
  );
}
