import { types as utilTypes } from "node:util";

const failures = {
  proxy: ["ERR_PROXY", "Proxy values are not allowed."],
  record: ["ERR_INVALID_RECORD", "Expected a plain record."],
  field: ["ERR_INVALID_FIELD", "Expected an enumerable data field."],
  unknownField: ["ERR_UNKNOWN_FIELD", "Unknown field."],
  missingField: ["ERR_MISSING_FIELD", "Missing required field."],
  kind: ["ERR_UNKNOWN_KIND", "Unknown kind."],
  variant: ["ERR_UNKNOWN_VARIANT", "Unknown relation variant."],
  invalidScalar: ["ERR_INVALID_SCALAR", "Expected a valid relation scalar."],
};
const relationVariants = new Set([
  "table", "partitioned_table", "foreign_table", "sequence", "view", "materialized_view",
]);

function reject([code, message]) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function snapshotRecord(value) {
  if (utilTypes.isProxy(value)) reject(failures.proxy);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    reject(failures.record);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) reject(failures.record);

  const keys = Reflect.ownKeys(value);
  const descriptors = new Map();
  for (const key of keys) {
    descriptors.set(key, Reflect.getOwnPropertyDescriptor(value, key));
  }
  return { prototype, keys, descriptors };
}

function validateSnapshot(snapshot, allowed, required, rejectOid = false) {
  for (const key of snapshot.keys) {
    const descriptor = snapshot.descriptors.get(key);
    if (
      typeof key === "symbol"
      || !descriptor.enumerable
      || !("value" in descriptor)
      || (rejectOid && key === "oid")
    ) reject(failures.field);
  }
  if (rejectOid && snapshot.prototype === Object.prototype
      && Object.hasOwn(Object.prototype, "oid")) reject(failures.field);
  for (const key of snapshot.keys) {
    if (!allowed.has(key)) reject(failures.unknownField);
  }
  for (const key of required) {
    if (!snapshot.descriptors.has(key)) reject(failures.missingField);
  }
}

export function canonicalizePanelAuthorization(input) {
  const envelope = snapshotRecord(input);
  validateSnapshot(envelope, new Set(["kind", "relation"]), ["kind", "relation"]);
  const kind = envelope.descriptors.get("kind").value;
  const relationValue = envelope.descriptors.get("relation").value;
  if (kind !== "relation") reject(failures.kind);

  const relation = snapshotRecord(relationValue);
  validateSnapshot(relation, new Set([
    "variant", "content", "schema", "name", "owner", "rlsEnabled", "rlsForced",
  ]), ["variant", "content", "schema", "name", "owner", "rlsEnabled", "rlsForced"], true);
  const variant = relation.descriptors.get("variant").value;
  if (!relationVariants.has(variant)) reject(failures.variant);

  const schema = relation.descriptors.get("schema").value;
  const name = relation.descriptors.get("name").value;
  const owner = relation.descriptors.get("owner").value;
  const rlsEnabled = relation.descriptors.get("rlsEnabled").value;
  const rlsForced = relation.descriptors.get("rlsForced").value;
  if (
    typeof schema !== "string" || schema.length === 0
    || typeof name !== "string" || name.length === 0
    || typeof owner !== "string" || owner.length === 0
    || typeof rlsEnabled !== "boolean"
    || typeof rlsForced !== "boolean"
  ) reject(failures.invalidScalar);
  return { kind: "relation", variant, schema, name, owner, rlsEnabled, rlsForced };
}
