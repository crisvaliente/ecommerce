import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITIES_BY_ROLE,
  PANEL_CAPABILITIES,
  PANEL_ROLES,
  hasPanelCapability,
} from "../src/lib/panelCapabilities.ts";

const expectedMatrix = [
  ["admin", "panel.enter", true],
  ["admin", "catalog.operate", true],
  ["admin", "orders.operate", true],
  ["admin", "orders.cancel", true],
  ["admin", "payments.access", true],
  ["admin", "companyRoles.admin", true],
  ["staff", "panel.enter", true],
  ["staff", "catalog.operate", true],
  ["staff", "orders.operate", true],
  ["staff", "orders.cancel", false],
  ["staff", "payments.access", false],
  ["staff", "companyRoles.admin", false],
  ["cliente", "panel.enter", false],
  ["cliente", "catalog.operate", false],
  ["cliente", "orders.operate", false],
  ["cliente", "orders.cancel", false],
  ["cliente", "payments.access", false],
  ["cliente", "companyRoles.admin", false],
];

for (const [role, capability, expected] of expectedMatrix) {
  test(`${role} ${expected ? "allows" : "denies"} ${capability}`, () => {
    assert.equal(hasPanelCapability(role, capability), expected);
  });
}

test("exports only the exact approved role and capability identities", () => {
  assert.deepEqual(PANEL_ROLES, ["admin", "staff", "cliente"]);
  assert.deepEqual(PANEL_CAPABILITIES, [
    "panel.enter",
    "catalog.operate",
    "orders.operate",
    "orders.cancel",
    "payments.access",
    "companyRoles.admin",
  ]);
  assert.deepEqual(CAPABILITIES_BY_ROLE, {
    admin: [...PANEL_CAPABILITIES],
    staff: ["panel.enter", "catalog.operate", "orders.operate"],
    cliente: [],
  });
});

test("denies cased and whitespace role or capability aliases", () => {
  assert.equal(hasPanelCapability("Admin", "panel.enter"), false);
  assert.equal(hasPanelCapability(" admin", "panel.enter"), false);
  assert.equal(hasPanelCapability("admin", "Panel.enter"), false);
  assert.equal(hasPanelCapability("admin", "panel.enter "), false);
});

test("denies unknown and malformed primitive values", () => {
  const invalidValues = [undefined, null, false, 0, 1n, Symbol("invalid")];

  for (const value of invalidValues) {
    assert.equal(hasPanelCapability(value, "panel.enter"), false);
    assert.equal(hasPanelCapability("admin", value), false);
  }
  assert.equal(hasPanelCapability("__proto__", "panel.enter"), false);
  assert.equal(hasPanelCapability("constructor", "panel.enter"), false);
  assert.equal(hasPanelCapability("admin", "constructor"), false);
});

test("denies objects and proxies without invoking coercion hooks", () => {
  let coercionCalls = 0;
  const hostile = {
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      return "admin";
    },
    toString() {
      coercionCalls += 1;
      return "panel.enter";
    },
    valueOf() {
      coercionCalls += 1;
      return "admin";
    },
  };
  const trapped = new Proxy({}, {
    get() {
      throw new Error("proxy property access is forbidden");
    },
  });

  assert.equal(hasPanelCapability(hostile, "panel.enter"), false);
  assert.equal(hasPanelCapability("admin", hostile), false);
  assert.equal(hasPanelCapability(trapped, "panel.enter"), false);
  assert.equal(hasPanelCapability("admin", trapped), false);
  assert.equal(hasPanelCapability(Object.create(null), "panel.enter"), false);
  assert.equal(coercionCalls, 0);
});

test("freezes every exported policy collection", () => {
  assert.equal(Object.isFrozen(PANEL_ROLES), true);
  assert.equal(Object.isFrozen(PANEL_CAPABILITIES), true);
  assert.equal(Object.isFrozen(CAPABILITIES_BY_ROLE), true);
  assert.equal(Object.isFrozen(CAPABILITIES_BY_ROLE.admin), true);
  assert.equal(Object.isFrozen(CAPABILITIES_BY_ROLE.staff), true);
  assert.equal(Object.isFrozen(CAPABILITIES_BY_ROLE.cliente), true);
  assert.throws(() => PANEL_ROLES.push("owner"), TypeError);
  assert.throws(() => CAPABILITIES_BY_ROLE.staff.push("orders.cancel"), TypeError);
  assert.throws(() => {
    CAPABILITIES_BY_ROLE.cliente = ["panel.enter"];
  }, TypeError);
});
