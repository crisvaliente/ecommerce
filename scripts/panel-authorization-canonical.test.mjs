import assert from "node:assert/strict";
import test from "node:test";

import { canonicalizePanelAuthorization } from "./lib/panel-authorization-canonical.mjs";

const SECRET = "secret-do-not-echo";
const CONTROL = "\u0001control-do-not-echo";
const validRelation = (content = { ignored: true }) => ({
  kind: "relation",
  relation: { variant: "table", content },
});

function captureFailure(input) {
  try {
    canonicalizePanelAuthorization(input);
    return undefined;
  } catch (error) {
    return error;
  }
}

function assertFailure(input, code, message, sentinels = [SECRET, CONTROL]) {
  const error = captureFailure(input);
  assert.ok(error instanceof Error, `expected ${code} rejection`);
  assert.equal(error.code, code);
  assert.equal(error.message, message);
  const publicFailure = JSON.stringify({ code: error.code, message: error.message });
  for (const sentinel of sentinels) assert.equal(publicFailure.includes(sentinel), false);
}

const failures = {
  proxy: ["ERR_PROXY", "Proxy values are not allowed."],
  record: ["ERR_INVALID_RECORD", "Expected a plain record."],
  field: ["ERR_INVALID_FIELD", "Expected an enumerable data field."],
  unknownField: ["ERR_UNKNOWN_FIELD", "Unknown field."],
  missingField: ["ERR_MISSING_FIELD", "Missing required field."],
  kind: ["ERR_UNKNOWN_KIND", "Unknown kind."],
  variant: ["ERR_UNKNOWN_VARIANT", "Unknown relation variant."],
};

function hostileProxy(target = {}) {
  const counts = Object.fromEntries([
    "get", "set", "has", "ownKeys", "getPrototypeOf", "setPrototypeOf",
    "getOwnPropertyDescriptor", "defineProperty", "deleteProperty", "isExtensible",
    "preventExtensions", "apply", "construct",
  ].map((name) => [name, 0]));
  let coercions = 0;
  Object.defineProperty(target, Symbol.toPrimitive, {
    configurable: true,
    get() { coercions += 1; return () => "hostile"; },
  });
  const handler = Object.fromEntries(Object.keys(counts).map((name) => [name, () => {
    counts[name] += 1;
    throw new Error(`${SECRET}:${name}:${CONTROL}`);
  }]));
  return { value: new Proxy(target, handler), counts, coercions: () => coercions };
}

function observeDescriptors(input, records) {
  const ownKeys = new Map(records.map((record) => [record, 0]));
  const descriptors = new Map(records.map((record) => [record, new Map()]));
  const originalOwnKeys = Reflect.ownKeys;
  const originalDescriptor = Reflect.getOwnPropertyDescriptor;
  let error;
  Reflect.ownKeys = (record) => {
    if (ownKeys.has(record)) ownKeys.set(record, ownKeys.get(record) + 1);
    return originalOwnKeys(record);
  };
  Reflect.getOwnPropertyDescriptor = (record, key) => {
    const seen = descriptors.get(record);
    if (seen) seen.set(key, (seen.get(key) ?? 0) + 1);
    return originalDescriptor(record, key);
  };
  try { error = captureFailure(input); }
  finally {
    Reflect.ownKeys = originalOwnKeys;
    Reflect.getOwnPropertyDescriptor = originalDescriptor;
  }
  return { error, ownKeys, descriptors };
}

function assertSnapshot(observed, expected) {
  for (const [record, keys] of expected) {
    assert.equal(observed.ownKeys.get(record), 1);
    assert.deepEqual([...observed.descriptors.get(record)], keys.map((key) => [key, 1]));
  }
}

test("accepts a plain relation table and emits only discriminants", () => {
  assert.deepEqual(canonicalizePanelAuthorization(validRelation()), {
    kind: "relation", variant: "table",
  });
});
test("accepts null-prototype envelope and relation records", () => {
  const relation = Object.assign(Object.create(null), { variant: "table", content: null });
  const input = Object.assign(Object.create(null), { kind: "relation", relation });
  assert.deepEqual(canonicalizePanelAuthorization(input), { kind: "relation", variant: "table" });
});
test("consumes caller discriminants from the complete descriptor snapshots", () => {
  const input = validRelation();
  const relation = input.relation;
  const originalDescriptor = Reflect.getOwnPropertyDescriptor;
  Reflect.getOwnPropertyDescriptor = (record, key) => {
    const descriptor = originalDescriptor(record, key);
    if (record === input && key === "kind") input.kind = SECRET;
    if (record === relation && key === "variant") relation.variant = CONTROL;
    return descriptor;
  };
  try {
    assert.deepEqual(canonicalizePanelAuthorization(input), { kind: "relation", variant: "table" });
  } finally {
    Reflect.getOwnPropertyDescriptor = originalDescriptor;
  }
  assert.equal(input.kind, SECRET);
  assert.equal(relation.variant, CONTROL);
});
test("accepts table while hostile content stays opaque and erased", () => {
  const hostile = hostileProxy();
  const result = canonicalizePanelAuthorization(validRelation(hostile.value));
  assert.deepEqual(result, { kind: "relation", variant: "table" });
  assert.deepEqual(hostile.counts, Object.fromEntries(Object.keys(hostile.counts).map((key) => [key, 0])));
  assert.equal(hostile.coercions(), 0);
  assert.equal(Object.hasOwn(result, "content"), false);
});
test("snapshots accepted envelope and relation descriptors exactly once", () => {
  const input = validRelation();
  const observed = observeDescriptors(input, [input, input.relation]);
  assertSnapshot(observed, [[input, ["kind", "relation"]], [input.relation, ["variant", "content"]]]);
  assert.equal(observed.error, undefined);
});
test("snapshots every envelope key before early unknown-field rejection", () => {
  const input = { [SECRET]: CONTROL, kind: "relation", relation: { variant: "table", content: null } };
  const observed = observeDescriptors(input, [input]);
  assertSnapshot(observed, [[input, [SECRET, "kind", "relation"]]]);
  assert.ok(observed.error instanceof Error);
  assert.equal(observed.error.code, failures.unknownField[0]);
});
test("snapshots every relation key before early accessor rejection", () => {
  let getterCalls = 0;
  const relation = { content: null, [SECRET]: CONTROL };
  Object.defineProperty(relation, "variant", { enumerable: true, get() { getterCalls += 1; return "table"; } });
  const input = { kind: "relation", relation };
  const observed = observeDescriptors(input, [input, relation]);
  assertSnapshot(observed, [[input, ["kind", "relation"]], [relation, ["content", SECRET, "variant"]]]);
  assert.equal(getterCalls, 0);
  assert.ok(observed.error instanceof Error);
  assert.equal(observed.error.code, failures.field[0]);
});
test("rejects own relation oid as an invalid field", () => {
  assertFailure({ kind: "relation", relation: { variant: "table", content: null, oid: SECRET } }, ...failures.field);
});
test("rejects inherited Object.prototype oid getter without invoking it", () => {
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "oid");
  let getterCalls = 0;
  let error;
  try {
    Object.defineProperty(Object.prototype, "oid", { configurable: true, get() { getterCalls += 1; return SECRET; } });
    error = captureFailure(validRelation());
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "oid", prior);
    else delete Object.prototype.oid;
  }
  assert.equal(getterCalls, 0);
  assert.ok(error instanceof Error);
  assert.equal(error.code, failures.field[0]);
  assert.equal(error.message, failures.field[1]);
});
test("rejects inherited Object.prototype oid value without reading it", () => {
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "oid");
  let error;
  try {
    Object.defineProperty(Object.prototype, "oid", { configurable: true, value: `${SECRET}${CONTROL}` });
    error = captureFailure(validRelation());
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "oid", prior);
    else delete Object.prototype.oid;
  }
  assert.ok(error instanceof Error);
  assert.equal(error.code, failures.field[0]);
  assert.equal(error.message, failures.field[1]);
});
for (const [name, input] of [
  ["array envelope", []], ["null envelope", null], ["primitive envelope", SECRET],
  ["custom-prototype envelope", Object.assign(Object.create({ inherited: SECRET }), validRelation())],
  ["array relation", { kind: "relation", relation: [] }],
  ["null relation", { kind: "relation", relation: null }],
  ["primitive relation", { kind: "relation", relation: CONTROL }],
  ["custom-prototype relation", { kind: "relation", relation: Object.assign(Object.create({ inherited: SECRET }), { variant: "table", content: null }) }],
]) test(`rejects invalid record: ${name}`, () => assertFailure(input, ...failures.record));
for (const [name, build] of [
  ["symbol envelope field", () => ({ ...validRelation(), [Symbol(SECRET)]: CONTROL })],
  ["symbol relation field", () => ({ kind: "relation", relation: { variant: "table", content: null, [Symbol(SECRET)]: CONTROL } })],
  ["non-enumerable envelope field", () => Object.defineProperty(validRelation(), SECRET, { value: CONTROL })],
  ["non-enumerable relation field", () => ({ kind: "relation", relation: Object.defineProperty({ variant: "table", content: null }, SECRET, { value: CONTROL }) })],
  ["envelope kind accessor", () => { const input = validRelation(); Object.defineProperty(input, "kind", { enumerable: true, get() { throw new Error(SECRET); } }); return input; }],
  ["relation variant accessor", () => { const relation = { content: null }; Object.defineProperty(relation, "variant", { enumerable: true, get() { throw new Error(SECRET); } }); return { kind: "relation", relation }; }],
]) test(`rejects invalid field: ${name}`, () => assertFailure(build(), ...failures.field));
for (const [name, input] of [
  ["unknown envelope field", { ...validRelation(), [SECRET]: CONTROL }],
  ["unknown relation field", { kind: "relation", relation: { variant: "table", content: null, [SECRET]: CONTROL } }],
]) test(`rejects unknown field: ${name}`, () => assertFailure(input, ...failures.unknownField));
for (const [name, input] of [
  ["missing envelope kind", { relation: { variant: "table", content: null } }],
  ["missing envelope relation", { kind: "relation" }],
  ["missing relation variant", { kind: "relation", relation: { content: null } }],
  ["missing relation content", { kind: "relation", relation: { variant: "table" } }],
]) test(`rejects missing field: ${name}`, () => assertFailure(input, ...failures.missingField));
test("rejects unknown kind with stable sentinel-free failure", () => {
  assertFailure({ kind: `${SECRET}${CONTROL}`, relation: { variant: "table", content: null } }, ...failures.kind);
});
for (const variant of [
  "partitioned_table", "foreign_table", "sequence", "view", "materialized_view", `${SECRET}${CONTROL}`,
]) test(`rejects unknown relation variant: ${JSON.stringify(variant)}`, () => {
  assertFailure({ kind: "relation", relation: { variant, content: null } }, ...failures.variant, [variant, SECRET, CONTROL]);
});
for (const location of ["envelope", "relation"]) test(`rejects ${location} Proxy before reflective traps`, () => {
  const hostile = hostileProxy(location === "envelope" ? validRelation() : { variant: "table", content: null });
  const input = location === "envelope" ? hostile.value : { kind: "relation", relation: hostile.value };
  const error = captureFailure(input);
  for (const trap of ["get", "ownKeys", "getPrototypeOf", "getOwnPropertyDescriptor"]) assert.equal(hostile.counts[trap], 0);
  assert.equal(hostile.coercions(), 0);
  assert.ok(error instanceof Error);
  assert.equal(error.code, failures.proxy[0]);
  assert.equal(error.message, failures.proxy[1]);
});
