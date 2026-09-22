import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const EXPECTED_API_PORT = "55491";
const EXPECTED_DB_PORT = "55476";
const EXPECTED_DB_IMAGE = "public.ecr.aws/supabase/postgres:15.8.1.085";

export function assertLocalMutationOptIn() {
  assert.equal(
    process.env.ALLOW_LOCAL_SUPABASE_MUTATIONS,
    "1",
    "set ALLOW_LOCAL_SUPABASE_MUTATIONS=1 before local environment discovery",
  );
}

export function loadGuardedLocalSupabase() {
  assertLocalMutationOptIn();
  const output = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });
  const env = Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="(.*)"$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );

  const apiUrl = new URL(env.API_URL);
  const restUrl = new URL(env.REST_URL);
  assert.equal(apiUrl.protocol, "http:", "local Supabase API must use HTTP");
  assert.equal(apiUrl.hostname, "127.0.0.1", "local Supabase API must use loopback");
  assert.equal(apiUrl.port, EXPECTED_API_PORT, "unexpected local Supabase API port");
  assert.equal(restUrl.origin, apiUrl.origin, "REST and API origins must match");
  assert.equal(restUrl.pathname, "/rest/v1", "unexpected local Supabase REST path");

  const identity = execFileSync(
    "docker",
    [
      "inspect",
      "--format",
      "{{.Name}}|{{.Config.Image}}|{{.State.Health.Status}}|{{json .NetworkSettings.Ports}}",
      "supabase_db_ecommerce",
    ],
    { encoding: "utf8" },
  ).trim();
  const [name, image, health, portsJson] = identity.split("|");
  assert.equal(name, "/supabase_db_ecommerce", "unexpected local database container");
  assert.equal(image, EXPECTED_DB_IMAGE, "unexpected local database image");
  assert.equal(health, "healthy", "local database container must be healthy");
  const databasePorts = JSON.parse(portsJson)["5432/tcp"] ?? [];
  assert.ok(
    databasePorts.some(({ HostPort }) => HostPort === EXPECTED_DB_PORT),
    "local database container is not bound to the ecommerce port",
  );

  return {
    env,
    service: createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export function createCleanupRegistry() {
  const cleanups = [];
  let sequence = 0;
  return {
    register(label, cleanup, priority = 400) {
      cleanups.push({ label, cleanup, priority, sequence: sequence++ });
    },
    async cleanup() {
      const errors = [];
      const pending = cleanups.splice(0).sort(
        (left, right) => right.priority - left.priority || right.sequence - left.sequence,
      );
      for (const { label, cleanup } of pending) {
        try {
          await cleanup();
        } catch (error) {
          errors.push(`${label}:${error?.code ?? error?.message ?? "unknown"}`);
        }
      }
      assert.deepEqual(errors, [], `fixture cleanup failed: ${errors.join(", ")}`);
    },
  };
}

export async function runTrackedSetup(registry, setup) {
  try {
    return await setup();
  } catch (setupError) {
    try {
      await registry.cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "fixture setup failed and partial-resource cleanup also failed",
      );
    }
    throw setupError;
  }
}

export async function trackedInsert(service, registry, table, values, key = "id") {
  const { data, error } = await service.from(table).insert(values).select(key).single();
  assert.ifError(error);
  const priority = table === "usuario" ? 300 : table === "empresa" ? 200 : 400;
  registry.register(`${table}:${data[key]}`, async () => {
    const { error: cleanupError } = await service.from(table).delete().eq(key, data[key]);
    if (cleanupError) throw cleanupError;
  }, priority);
  return data;
}

export async function createTrackedCompany(service, registry, label) {
  const id = randomUUID();
  await trackedInsert(service, registry, "empresa", {
    id,
    nombre: `Panel fixture ${label}`,
    slug: `panel-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${id}`,
  });
  return id;
}

export async function createTrackedAuthProfile(
  service,
  registry,
  { label, empresaId = null, role = "cliente", onboarding = empresaId === null },
) {
  return runTrackedSetup(registry, async () => {
    const authUserId = randomUUID();
    const email = `panel-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${authUserId}@example.test`;
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      id: authUserId,
      email,
      email_confirm: true,
      user_metadata: { name: `Panel ${label}` },
    });
    assert.ifError(authError);
    assert.equal(authData.user?.id, authUserId);
    registry.register(`auth.users:${authUserId}`, async () => {
      const { error } = await service.auth.admin.deleteUser(authUserId);
      if (error) throw error;
    }, 100);

    const { data: profiles, error: profileError } = await service
      .from("usuario")
      .select("id, supabase_uid, correo, rol, empresa_id, onboarding")
      .eq("supabase_uid", authUserId)
      .limit(2);
    assert.ifError(profileError);
    assert.equal(profiles.length, 1, "Auth creation must trigger exactly one profile");
    let profile = profiles[0];
    registry.register(`usuario:${profile.id}`, async () => {
      const { error } = await service.from("usuario").delete().eq("id", profile.id).eq("supabase_uid", authUserId);
      if (error) throw error;
    }, 300);

    assert.equal(profile.supabase_uid, authUserId);
    assert.equal(profile.rol, "cliente");
    assert.equal(profile.empresa_id, null);
    assert.equal(profile.onboarding, true);

    if (role !== "cliente" || empresaId !== null || onboarding !== true) {
      const { data: promoted, error: promotionError } = await service
        .from("usuario")
        .update({ rol: role, empresa_id: empresaId, onboarding })
        .eq("id", profile.id)
        .eq("supabase_uid", authUserId)
        .eq("rol", "cliente")
        .is("empresa_id", null)
        .eq("onboarding", true)
        .select("id, supabase_uid, correo, rol, empresa_id, onboarding")
        .maybeSingle();
      assert.ifError(promotionError);
      assert.ok(promoted, "trusted fixture promotion must affect the known fresh profile");
      profile = promoted;
    }

    return { authUserId, email, profileId: profile.id, profile };
  });
}
