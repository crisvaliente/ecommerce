import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createCleanupRegistry,
  createTrackedAuthProfile,
  createTrackedCompany,
  loadGuardedLocalSupabase,
} from "./lib/local-auth-fixtures.mjs";

const { service } = loadGuardedLocalSupabase();

async function profileById(id) {
  const { data, error } = await service
    .from("usuario")
    .select("id, supabase_uid, rol, empresa_id, onboarding")
    .eq("id", id)
    .maybeSingle();
  assert.ifError(error);
  return data;
}

async function removeOwnedProfile(id) {
  const { error } = await service.from("usuario").delete().eq("id", id);
  if (error) throw error;
}

test("Auth creation produces exactly one canonical default profile", async () => {
  const registry = createCleanupRegistry();
  try {
    const identity = await createTrackedAuthProfile(service, registry, { label: "trigger-default" });
    assert.deepEqual(
      {
        supabase_uid: identity.profile.supabase_uid,
        rol: identity.profile.rol,
        empresa_id: identity.profile.empresa_id,
        onboarding: identity.profile.onboarding,
      },
      {
        supabase_uid: identity.authUserId,
        rol: "cliente",
        empresa_id: null,
        onboarding: true,
      },
    );
  } finally {
    await registry.cleanup();
  }
});

test("usuario rejects a profile whose UID has no Auth parent", async () => {
  const profileId = randomUUID();
  const fakeUid = randomUUID();
  let inserted = false;
  try {
    const result = await service.from("usuario").insert({
      id: profileId,
      supabase_uid: fakeUid,
      nombre: "Orphan fixture",
      correo: `orphan-${profileId}@example.test`,
      rol: "cliente",
      empresa_id: null,
      onboarding: true,
    });
    inserted = !result.error;
    assert.equal(result.error?.code, "23503");
    assert.equal(await profileById(profileId), null);
  } finally {
    if (inserted) await removeOwnedProfile(profileId);
  }
});

test("usuario rejects privileged roles without an assigned company", async () => {
  const registry = createCleanupRegistry();
  try {
    const identity = await createTrackedAuthProfile(service, registry, { label: "privileged-check" });
    const result = await service
      .from("usuario")
      .update({ rol: "staff", empresa_id: null, onboarding: true })
      .eq("id", identity.profileId);
    assert.equal(result.error?.code, "23514");
    assert.deepEqual(await profileById(identity.profileId), {
      id: identity.profileId,
      supabase_uid: identity.authUserId,
      rol: "cliente",
      empresa_id: null,
      onboarding: true,
    });
  } finally {
    await registry.cleanup();
  }
});

test("company deletion is restricted while an owned profile depends on it", async () => {
  const registry = createCleanupRegistry();
  try {
    const empresaId = await createTrackedCompany(service, registry, "delete-restrict");
    const identity = await createTrackedAuthProfile(service, registry, {
      label: "delete-restrict-admin",
      empresaId,
      role: "admin",
      onboarding: false,
    });
    const deletion = await service.from("empresa").delete().eq("id", empresaId);
    assert.equal(deletion.error?.code, "23503");
    assert.equal((await profileById(identity.profileId)).empresa_id, empresaId);
  } finally {
    await registry.cleanup();
  }
});

test("trigger refuses email adoption and preserves the owned conflicting profile", async () => {
  const registry = createCleanupRegistry();
  const conflictEmail = `trigger-conflict-${randomUUID()}@example.test`;
  let secondAuthId = null;
  let firstIdentity;
  try {
    const first = await createTrackedAuthProfile(service, registry, { label: "conflict-source" });
    firstIdentity = first;
    const { error: profileEmailError } = await service
      .from("usuario")
      .update({ correo: conflictEmail })
      .eq("id", first.profileId)
      .eq("supabase_uid", first.authUserId);
    assert.ifError(profileEmailError);

    const secondId = randomUUID();
    const creation = await service.auth.admin.createUser({
      id: secondId,
      email: conflictEmail,
      email_confirm: true,
    });
    secondAuthId = creation.data.user?.id ?? null;
    assert.ok(creation.error, "conflicting profile email must abort Auth creation");
    assert.equal(secondAuthId, null);
    assert.equal((await profileById(first.profileId)).supabase_uid, first.authUserId);
  } finally {
    if (secondAuthId) {
      const { error: adoptedProfileCleanupError } = await service
        .from("usuario")
        .update({ supabase_uid: firstIdentity.authUserId })
        .eq("id", firstIdentity.profileId)
        .eq("supabase_uid", secondAuthId);
      if (adoptedProfileCleanupError) throw adoptedProfileCleanupError;
      const { error: authCleanupError } = await service.auth.admin.deleteUser(secondAuthId);
      if (authCleanupError) throw authCleanupError;
    }
    await registry.cleanup();
  }
});
