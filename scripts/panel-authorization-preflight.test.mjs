import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const HARNESS = new URL("./lib/panel-authorization-preflight-harness.mjs", import.meta.url);
const PREFLIGHT = new URL("./sql/panel-authorization-preflight.sql", import.meta.url);

const REQUIRED_OBJECT_KEYS = [
  "public.usuario.usuario_supabase_uid_auth_fkey",
  "public.usuario.usuario_empresa_restrict_fkey",
  "public.usuario.usuario_privileged_company_check",
  "public.handle_new_auth_user()",
  "auth.users.on_auth_user_created",
  "public.empresa.empresa_select_own_company",
  "public.producto.producto_select_gate3_catalog_roles",
  "public.categoria.categoria_select_gate3_catalog_roles",
  "public.producto_categoria.producto_categoria_select_gate3_catalog_roles",
  "public.producto_variante.producto_variante_select_gate3_catalog_roles",
  "public.imagen_producto.imagen_producto_select_gate3_catalog_roles",
  "storage.objects.producto_imagenes_select_gate3_catalog_roles",
  "storage.buckets.producto-imagenes",
];
const REPLACEMENTS = new Map([
  ["public.usuario.usuario_empresa_id_fkey", "public.usuario.usuario_empresa_restrict_fkey"],
  ["public.handle_new_auth_user()", "public.handle_new_auth_user()"],
  ["auth.users.on_auth_user_created", "auth.users.on_auth_user_created"],
  ["public.usuario.usuario_set_uid", "ABSENT"],
  ["public.set_supabase_uid_from_jwt()", "ABSENT"],
  ["public.empresa.select_empresa_authenticated", "public.empresa.empresa_select_own_company"],
  ["public.empresa.empresa_select_members", "ABSENT"],
  ["storage.objects.pi_read_public", "ABSENT"],
]);
const PRESERVED_KEYS = [
  "public.can_mutate_catalog_empresa(uuid)",
  "public.can_mutate_catalog_producto(uuid)",
  "public.soft_delete_imagen_producto(uuid)",
  "public.empresa_dominio",
];

async function manifests() {
  return (await import(HARNESS)).readSealedManifests();
}
function canonicalize(h, snapshot, assertion) {
  assert.equal(typeof h.canonicalizeCatalogSnapshot, "function", assertion);
  return h.canonicalizeCatalogSnapshot(snapshot);
}
function assertStableSemanticIdentity(h, base, reordered, changed, assertion) {
  const identity = canonicalize(h, base, assertion);
  assert.equal(canonicalize(h, reordered, assertion), identity, `${assertion}: ordering and OIDs must be ignored`);
  assert.notEqual(canonicalize(h, changed, assertion), identity, `${assertion}: semantic changes must alter identity`);
}

test("manifests pin the exact repository predecessor history", async () => {
  const h = await import(HARNESS);
  const history = h.readPinnedHistory();
  assert.deepEqual({ commit: history.commit, count: history.rows.length, aggregate: history.aggregate }, {
    commit: "526f614be9cc1efc9269bc62996eaa85b3504be2", count: 67,
    aggregate: "2903b6394145b3c902452527ea7842f29b7af31ef0038693dccde5df2a0f8b54",
  });
  assert.deepEqual(history.rows.slice(-3), [
    "20260902120000|multi_tenant_gate_1_catalog_stock_isolation|7144f1951c855a386348122591cc1518479a5ecc44c73709bb7fbafe5d88588b",
    "20260903120000|multi_tenant_gate_2_empresa_dominio|eacb6a0c7b4d0cb1c14809e595aff0de20b4b5e1ddc2691b6b93714e1286cac1",
    "20260903130000|checkout_idempotency_service_role_select|c237a059782beffe292190d43185cd9bea4e9a9c9e746b3930aea15de3b26d57",
  ]);
});

test("manifests expose literal finite per-object PRE and POST rows", async () => {
  const rows = await manifests();
  const broad = rows.filter(row => row.object_key.startsWith("rooted-closure:")).map(row => `${row.manifest_version}:${row.kind}:${row.object_key}`);
  assert.deepEqual(broad, [], "R3-006 manifests must use stable per-object keys; broad per-kind rooted-closure aggregates are forbidden");
  assert.ok(rows.length > 32, "R3-006 manifests must enumerate the finite object inventory rather than one row per kind");
  assert.ok(rows.every(row => row.expected_count === 0 || row.expected_count === 1), "R3-006 each literal object row must have exact count 0 or 1");
});

test("manifests contain exact Gate3 target object keys and metadata", async () => {
  const rows = await manifests();
  const post = new Map(rows.filter(row => row.mode === "POST").map(row => [row.object_key, row]));
  assert.deepEqual(REQUIRED_OBJECT_KEYS.filter(key => !post.has(key)), [], "R3-006 target manifest is missing required stable Gate3 object keys");
  for (const key of REQUIRED_OBJECT_KEYS) {
    const row = post.get(key);
    assert.ok(["required_safe", "required_absent"].includes(row.classification), `R3-006 ${key} has an inexact classification`);
    assert.match(row.owner, /^(?:postgres|supabase_admin|storage_admin|authenticator|NONE)$/i, `R3-006 ${key} must expose its exact owner, not an aggregate hash`);
    for (const field of ["acl", "dependency", "canonical_sha256"]) assert.match(row[field], /^[a-f0-9]{64}$/, `R3-006 ${key} ${field} must be an exact literal hash`);
  }
});

test("manifests pin exact replacement and removal mappings", async () => {
  const rows = await manifests();
  const pre = new Map(rows.filter(row => row.mode === "PRE").map(row => [row.object_key, row]));
  const actual = Object.fromEntries([...REPLACEMENTS].map(([key]) => [key, pre.get(key)?.replacement_key]));
  assert.deepEqual(actual, Object.fromEntries(REPLACEMENTS), "R3-006 every unsafe predecessor must map to its exact replacement or ABSENT removal");
  const selfMappings = rows.filter(row => row.classification === "replaceable_by_gate3" && row.object_key === row.replacement_key && !REPLACEMENTS.has(row.object_key));
  assert.deepEqual(selfMappings, [], "R3-006 broad or unexplained PRE-to-POST self-mappings are forbidden");
});

test("manifests preserve unchanged object hashes", async () => {
  const rows = await manifests();
  const pre = new Map(rows.filter(row => row.mode === "PRE").map(row => [row.object_key, row]));
  const post = new Map(rows.filter(row => row.mode === "POST").map(row => [row.object_key, row]));
  const missing = PRESERVED_KEYS.filter(key => !pre.has(key) || !post.has(key));
  assert.deepEqual(missing, [], "R3-006 manifests must enumerate the known preserved Gate1/Gate2 objects independently");
  for (const key of PRESERVED_KEYS) assert.equal(post.get(key).canonical_sha256, pre.get(key).canonical_sha256, `R3-006 preserved object hash changed: ${key}`);
});

test("manifests validator rejects aggregate and self-mapped inventories", async () => {
  const h = await import(HARNESS);
  const rows = h.readSealedManifests();
  const aggregate = structuredClone(rows);
  for (const row of aggregate) row.object_key = `rooted-closure:${row.kind}`;
  assert.throws(() => h.validateManifestRows(aggregate), /literal per-object|aggregate/i, "R3-006 validator must reject broad per-kind aggregate manifests");
  const selfMapped = structuredClone(rows);
  const post = new Map(selfMapped.filter(row => row.mode === "POST").map(row => [row.object_key, row]));
  for (const row of selfMapped.filter(row => row.classification === "replaceable_by_gate3")) {
    row.replacement_key = row.object_key;
    row.replacement_sha256 = post.get(row.object_key)?.canonical_sha256 ?? row.canonical_sha256;
  }
  assert.throws(() => h.validateManifestRows(selfMapped), /exact replacement|self-map/i, "R3-006 validator must reject broad replacement self-mappings");
});

test("canonicalizer follows recursive dependency closure and ignores ordering and OIDs", async () => {
  const h = await import(HARNESS);
  const base = { roots: ["relation:public.root"], objects: [{ oid: 10, key: "relation:public.root", value: "root" }, { oid: 20, key: "routine:public.mid()", value: "mid" }, { oid: 30, key: "relation:public.leaf", value: "leaf" }], dependencies: [[10, 20], [20, 30]] };
  const reordered = { roots: base.roots, objects: [{ ...base.objects[2], oid: 903 }, { ...base.objects[0], oid: 901 }, { ...base.objects[1], oid: 902 }], dependencies: [[902, 903], [901, 902]] };
  const changed = structuredClone(base); changed.objects[2].value = "semantic-leaf-change";
  assertStableSemanticIdentity(h, base, reordered, changed, "R3-007 recursive dependency closure identity");
});

test("canonicalizer normalizes relation, default, and routine ACL semantics", async () => {
  const h = await import(HARNESS);
  const base = { roots: ["routine:public.f(uuid)"], objects: [{ key: "routine:public.f(uuid)", kind: "routine", owner: "postgres", acl: ["authenticated:X", "anon:X"], defaultAcl: ["postgres:functions:service_role:X"], config: ["statement_timeout=3s", "search_path=pg_catalog, public"], body: "select $1" }] };
  const reordered = structuredClone(base); reordered.objects[0].acl.reverse(); reordered.objects[0].config.reverse();
  const changed = structuredClone(base); changed.objects[0].owner = "authenticator";
  assertStableSemanticIdentity(h, base, reordered, changed, "R3-007 ACL/default ACL/routine ACL+config+owner identity");
});

test("canonicalizer normalizes trigger bindings and view options", async () => {
  const h = await import(HARNESS);
  const base = { roots: ["trigger:auth.users.on_auth_user_created", "view:public.producto_stock_resumen"], objects: [{ key: "trigger:auth.users.on_auth_user_created", kind: "trigger", timing: "AFTER", events: ["INSERT"], binding: "public.handle_new_auth_user()", enabled: "O" }, { key: "view:public.producto_stock_resumen", kind: "view", definition: "select producto_id, stock from public.producto_variante", owner: "postgres", acl: ["authenticated:r"], options: ["security_invoker=true", "security_barrier=false"] }] };
  const reordered = structuredClone(base); reordered.roots.reverse(); reordered.objects.reverse(); reordered.objects[0].options.reverse();
  const changed = structuredClone(base); changed.objects[1].options[0] = "security_invoker=false";
  assertStableSemanticIdentity(h, base, reordered, changed, "R3-007 trigger/function binding and view definition/options/owner/ACL identity");
});

test("canonicalizer normalizes storage, migration, and global callable routine semantics", async () => {
  const h = await import(HARNESS);
  const base = { roots: ["bucket:producto-imagenes"], objects: [{ key: "bucket:producto-imagenes", kind: "bucket", public: false, fileSize: 5242880, mime: ["image/png", "image/jpeg"], objectMetadataHashes: ["b", "a"] }, { key: "migration:20260903130000", kind: "migration", name: "checkout_idempotency_service_role_select", statementHash: "a".repeat(64) }, { key: "routine:public.browser_rpc()", kind: "routine_acl", effectiveCallable: ["anon", "authenticated"], acl: "DEFAULT" }] };
  const reordered = structuredClone(base); reordered.objects.reverse(); reordered.objects[2].objectMetadataHashes.reverse();
  const changed = structuredClone(base); changed.objects[2].effectiveCallable = ["authenticated"];
  assertStableSemanticIdentity(h, base, reordered, changed, "R3-007 storage bucket+hashed metadata, migration history, and global effective callable identity");
});

const SEMANTIC_MUTATIONS = [
  ["auth-uid-fk-removed", "alter table public.usuario drop constraint usuario_supabase_uid_auth_fkey"],
  ["company-restrict-and-check-removed", "alter table public.usuario drop constraint usuario_empresa_restrict_fkey; alter table public.usuario drop constraint usuario_privileged_company_check"],
  ["email-adoption-trigger-restored", "create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer as $$begin update public.usuario set supabase_uid=new.id where lower(email)=lower(new.email); return new; end$$"],
  ["role-blind-catalog-policy-added", "create policy gate3_mutation_catalog_bypass on public.producto for select to authenticated using (true)"],
  ["global-empresa-policy-added", "create policy gate3_mutation_empresa_bypass on public.empresa for select to authenticated using (true)"],
  ["public-storage-policy-added", "create policy gate3_mutation_storage_bypass on storage.objects for select to public using (bucket_id='producto-imagenes')"],
  ["predecessor-uid-trigger-restored", "create function public.set_supabase_uid_from_jwt() returns trigger language plpgsql as $$begin return new; end$$; create trigger usuario_set_uid before insert on public.usuario for each row execute function public.set_supabase_uid_from_jwt()"],
];

test("fixtures materialize and behaviorally prove every target-safe Gate3 contract", async t => {
  const h = await import(HARNESS);
  const target = h.materializeFixture("target-safe", { semanticMutations: SEMANTIC_MUTATIONS.map(([name, sql]) => ({ name, sql })) });
  const expected = {
    identity: { authUidFk: "ON DELETE RESTRICT VALIDATED", companyFk: "ON DELETE RESTRICT VALIDATED", privilegedCompanyCheck: "VALIDATED" },
    provisioning: { uidKeyed: true, emailAdoption: false, duplicateEmail: "reject", publicExecute: false },
    catalog: { roles: ["admin", "staff"], cliente: "deny", commands: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
    empresa: { authenticated: "own-company-select-only", mutations: "deny" },
    storage: { bucket: "producto-imagenes", public: false, roles: ["admin", "staff"], update: "deny", metadataHashed: true },
    predecessors: { emailAdoption: "absent", membershipAuthority: "absent", uidWriteTrigger: "absent", publicStorageRead: "absent", roleBlindCatalog: "absent" },
  };
  for (const [area, behavior] of Object.entries(expected)) await t.test(`fixtures target-safe ${area}`, () => {
    assert.deepEqual(target.behavior?.[area], behavior, `R3-005 target-safe fixture must materially prove ${area} behavior and reject the stopped unsafe target fixture`);
  });
  await t.test("fixtures reject every actual semantic regression mutation", () => {
    const actual = Object.fromEntries((target.semanticMutations ?? []).map(result => [result.name, { status: result.status, identity_changed: result.identity_changed }]));
    const blocked = Object.fromEntries(SEMANTIC_MUTATIONS.map(([name]) => [name, { status: "blocked", identity_changed: true }]));
    assert.deepEqual(actual, blocked, "R3-008 actual disposable fixture semantic mutations must change identity and be rejected; predecessor behavior must not remain");
  });
  assert.equal(target.transport, "docker-exec-local");
  assert.equal(target.disposed, true);
});

test("manifests keep the operational preflight hard sealed", () => {
  const sql = readFileSync(PREFLIGHT, "utf8");
  assert.match(sql, /gate3-predecessor-v2[\s\S]*gate3-target-v2/);
  assert.match(sql, /20260904120000_multi_tenant_gate_3_panel_authorization\.sql/);
  assert.match(sql, /reviewed_migration_sha256\s*=\s*null/i);
  assert.match(sql, /operational[^\n]*unverifiable[^\n]*(?:\\quit 4|exit 4)/i);
  assert.doesNotMatch(sql, /gate3-test-only|migration_required[^\n]*\\quit 0|overall_status[^\n]*pass/i);
  assert.equal(execFileSync("git", ["status", "--short", "--", "supabase/migrations"], { cwd: ROOT, encoding: "utf8" }), "");
});
