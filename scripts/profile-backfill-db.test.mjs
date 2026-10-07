import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createCleanupRegistry,
  createTrackedAuthProfile,
  loadGuardedLocalSupabase,
  runTrackedSetup,
} from "./lib/local-auth-fixtures.mjs";

const { service } = loadGuardedLocalSupabase();
const MIGRATION = new URL(
  "../supabase/migrations/20260930120000_backfill_missing_usuario_profiles.sql",
  import.meta.url,
);

// The backfill touches every Auth user without a profile, including fixtures that
// other test files are tearing down, so run this file on its own:
//   ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --test scripts/profile-backfill-db.test.mjs

/** Runs the migration file against the local database, as `db push` would. */
function applyBackfill() {
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_ecommerce", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: readFileSync(MIGRATION, "utf8"), encoding: "utf8" },
  );
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

function psql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_ecommerce", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: sql, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
}

const sqlText = (value) => (value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`);

/**
 * Inserts an Auth user directly, with triggers off for this session only, to
 * reproduce accounts the Auth API would not create (null or case-variant emails).
 */
function insertRawLegacyAuthUser(registry, { email, name = null }) {
  const id = randomUUID();
  const meta = name === null ? "'{}'::jsonb" : `jsonb_build_object('name', ${sqlText(name)})`;
  psql(`set session_replication_role = replica;
    insert into auth.users (id, aud, role, email, raw_user_meta_data) values ('${id}', 'authenticated', 'authenticated', ${sqlText(email)}, ${meta});`);
  registry.register(`raw-auth:${id}`, async () => {
    psql(`delete from public.usuario where supabase_uid = '${id}'; delete from auth.users where id = '${id}';`);
  }, 250);
  return id;
}

async function profileOf(authUserId) {
  const { data, error } = await service
    .from("usuario")
    .select("id, supabase_uid, correo, nombre, rol, empresa_id, onboarding")
    .eq("supabase_uid", authUserId);
  assert.ifError(error);
  return data;
}

/** An Auth user whose profile was never created (accounts from before the Auth trigger). */
async function createLegacyAuthUser(registry, label) {
  const identity = await createTrackedAuthProfile(service, registry, { label });
  const { error } = await service.from("usuario").delete().eq("id", identity.profileId);
  assert.ifError(error);
  assert.deepEqual(await profileOf(identity.authUserId), []);
  return identity;
}

async function withRegistry(run) {
  const registry = createCleanupRegistry();
  try {
    await runTrackedSetup(registry, () => run(registry));
  } finally {
    await registry.cleanup();
  }
}

test("creates the missing profile exactly as the Auth trigger would", async () => {
  await withRegistry(async (registry) => {
    const legacy = await createLegacyAuthUser(registry, "Backfill Legacy");
    const existing = await createTrackedAuthProfile(service, registry, { label: "Backfill Existing" });
    const before = await profileOf(existing.authUserId);

    const run = applyBackfill();
    assert.ok(run.ok, run.output);

    assert.deepEqual(await profileOf(legacy.authUserId), [{
      id: legacy.authUserId,
      supabase_uid: legacy.authUserId,
      correo: legacy.email,
      nombre: "Panel Backfill Legacy",
      rol: "cliente",
      empresa_id: null,
      onboarding: true,
    }]);
    assert.deepEqual(await profileOf(existing.authUserId), before);
  });
});

test("running it again changes nothing", async () => {
  await withRegistry(async (registry) => {
    const legacy = await createLegacyAuthUser(registry, "Backfill Twice");
    assert.ok(applyBackfill().ok);
    const first = await profileOf(legacy.authUserId);

    const again = applyBackfill();
    assert.ok(again.ok, again.output);
    assert.deepEqual(await profileOf(legacy.authUserId), first);
  });
});

test("an email already used by another profile aborts the whole backfill", async () => {
  await withRegistry(async (registry) => {
    const legacy = await createLegacyAuthUser(registry, "Backfill Conflict");
    const other = await createLegacyAuthUser(registry, "Backfill Bystander");
    const holder = await createTrackedAuthProfile(service, registry, { label: "Backfill Holder" });
    const { error } = await service
      .from("usuario")
      .update({ correo: legacy.email.toUpperCase() })
      .eq("id", holder.profileId);
    assert.ifError(error);

    const run = applyBackfill();
    assert.equal(run.ok, false);
    assert.match(run.output, /usuario_backfill_email_conflict/);
    assert.deepEqual(await profileOf(legacy.authUserId), []);
    assert.deepEqual(await profileOf(other.authUserId), [], "nothing is backfilled when one row conflicts");
  });
});

test("normalizes the email and falls back to it when there is no name", async () => {
  await withRegistry(async (registry) => {
    const tag = randomUUID();
    const id = insertRawLegacyAuthUser(registry, { email: `  Mixed-${tag}@Example.Test ` });

    const run = applyBackfill();
    assert.ok(run.ok, run.output);
    const [profile] = await profileOf(id);
    assert.equal(profile.correo, `mixed-${tag}@example.test`);
    assert.equal(profile.nombre, `mixed-${tag}@example.test`);
  });
});

test("two users without profile sharing a normalized email abort the backfill", async () => {
  await withRegistry(async (registry) => {
    const tag = randomUUID();
    const first = insertRawLegacyAuthUser(registry, { email: `Dup-${tag}@example.test`, name: "Dup A" });
    const second = insertRawLegacyAuthUser(registry, { email: `dup-${tag}@example.test`, name: "Dup B" });

    const run = applyBackfill();
    assert.equal(run.ok, false);
    assert.match(run.output, /usuario_backfill_email_conflict/);
    assert.deepEqual(await profileOf(first), []);
    assert.deepEqual(await profileOf(second), []);
  });
});

test("a user without email or whose id is taken aborts the backfill", async (t) => {
  await t.test("no email", async () => {
    await withRegistry(async (registry) => {
      const id = insertRawLegacyAuthUser(registry, { email: null, name: "No Email" });
      const run = applyBackfill();
      assert.equal(run.ok, false);
      assert.match(run.output, /usuario_backfill_email_conflict/);
      assert.deepEqual(await profileOf(id), []);
    });
  });
  await t.test("id taken", async () => {
    await withRegistry(async (registry) => {
      const legacy = await createLegacyAuthUser(registry, "Backfill Id Taken");
      const owner = await createLegacyAuthUser(registry, "Backfill Id Owner");
      const { error } = await service.from("usuario").insert({
        id: legacy.authUserId, supabase_uid: owner.authUserId, correo: owner.email,
        nombre: "Owner", rol: "cliente", empresa_id: null, onboarding: true,
      });
      assert.ifError(error);
      registry.register(`usuario:${legacy.authUserId}`, async () => {
        const { error: cleanupError } = await service.from("usuario").delete().eq("id", legacy.authUserId);
        if (cleanupError) throw cleanupError;
      }, 350);

      const run = applyBackfill();
      assert.equal(run.ok, false);
      assert.match(run.output, /usuario_backfill_email_conflict/);
      assert.deepEqual(await profileOf(legacy.authUserId), []);
    });
  });
});
