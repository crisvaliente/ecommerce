import assert from "node:assert/strict";
import test from "node:test";

import {
  createCleanupRegistry,
  createTrackedAuthProfile,
} from "./lib/local-auth-fixtures.mjs";
import {
  ensureBootstrapUser,
  findAuthUserByEmail,
} from "./lib/supabase-bootstrap.mjs";

function bootstrapDouble({ authUser, profiles, companies = [{ id: "company-a" }] }) {
  const operations = [];
  const rows = profiles.map((row) => ({ ...row }));

  function query(table, action, values) {
    const filters = [];
    const tableRows = table === "empresa" ? companies : rows;
    const matches = () => tableRows.filter((row) => filters.every(([key, value]) => row[key] === value));
    const builder = {
      select() { return builder; },
      eq(column, value) { filters.push([column, value]); return builder; },
      limit(count) { return Promise.resolve({ data: matches().slice(0, count).map((row) => ({ ...row })), error: null }); },
      maybeSingle() {
        const found = matches();
        return Promise.resolve({ data: found.length === 1 ? { ...found[0] } : null, error: null });
      },
      then(resolve) {
        operations.push({ table, action, values, filters: [...filters] });
        if (action === "update") {
          for (const row of matches()) Object.assign(row, values);
        } else if (action === "insert") {
          rows.push({ ...values });
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return builder;
  }

  return {
    operations,
    rows,
    supabase: {
      auth: {
        admin: {
          async listUsers() { return { data: { users: authUser ? [authUser] : [] }, error: null }; },
          async createUser(values) {
            operations.push({ action: "createAuth", values });
            return { data: { user: { id: "new-auth-id", email: values.email } }, error: null };
          },
          async updateUserById(id, values) {
            operations.push({ action: "updateAuth", id, values });
            return { data: { user: authUser }, error: null };
          },
        },
      },
      from(table) {
        return {
          select() { return query(table, "select"); },
          update(values) { return query(table, "update", values); },
          insert(values) { return query(table, "insert", values); },
        };
      },
    },
  };
}

const config = {
  email: " Admin@Example.Test ",
  password: "fixture-only",
  name: "Bootstrap Admin",
  role: "admin",
  empresaId: "company-a",
  onboarding: false,
};

function freshProfile(overrides = {}) {
  return {
    id: "profile-a",
    correo: "admin@example.test",
    supabase_uid: "auth-a",
    empresa_id: null,
    rol: "cliente",
    onboarding: true,
    ...overrides,
  };
}

test("failed Auth-profile setup immediately cleans every registered partial resource", async () => {
  let deletedAuthId = null;
  const service = {
    auth: {
      admin: {
        async createUser({ id, email }) {
          return { data: { user: { id, email } }, error: null };
        },
        async deleteUser(id) {
          deletedAuthId = id;
          return { error: null };
        },
      },
    },
    from(table) {
      assert.equal(table, "usuario");
      const query = {
        select() { return query; },
        eq() { return query; },
        async limit() { return { data: [], error: null }; },
      };
      return query;
    },
  };
  const registry = createCleanupRegistry();

  await assert.rejects(
    createTrackedAuthProfile(service, registry, { label: "partial-setup" }),
    /exactly one profile/,
  );
  assert.ok(deletedAuthId, "Auth cleanup must run before setup rejects");
  await registry.cleanup();
});

test("findAuthUserByEmail normalizes comparison and stops on the matching page", async () => {
  const calls = [];
  const supabase = { auth: { admin: { async listUsers(options) {
    calls.push(options);
    return { data: { users: [{ id: "auth-a", email: "ADMIN@example.test" }] }, error: null };
  } } } };
  assert.equal((await findAuthUserByEmail(supabase, "admin@example.test")).id, "auth-a");
  assert.deepEqual(calls, [{ page: 1, perPage: 200 }]);
});

test("bootstrap promotion is one conditional fresh-default to admin transition", async () => {
  const authUser = { id: "auth-a", email: "admin@example.test", user_metadata: {} };
  const fixture = bootstrapDouble({ authUser, profiles: [freshProfile()] });
  const result = await ensureBootstrapUser(fixture.supabase, config);
  assert.equal(result.profile.rol, "admin");

  const promotion = fixture.operations.find(({ table, action }) => table === "usuario" && action === "update");
  assert.ok(promotion, "bootstrap must issue the promotion update");
  assert.deepEqual(promotion.values, {
    rol: "admin",
    empresa_id: "company-a",
    onboarding: false,
    updated_at: promotion.values.updated_at,
  });
  assert.deepEqual(promotion.filters, [
    ["id", "profile-a"],
    ["supabase_uid", "auth-a"],
    ["rol", "cliente"],
    ["empresa_id", null],
    ["onboarding", true],
  ]);
});

test("bootstrap rejects non-admin role configuration without profile mutation", async () => {
  const authUser = { id: "auth-a", email: "admin@example.test", user_metadata: {} };
  const fixture = bootstrapDouble({ authUser, profiles: [freshProfile()] });
  await assert.rejects(
    ensureBootstrapUser(fixture.supabase, { ...config, role: "staff" }),
    /admin/i,
  );
  assert.deepEqual(fixture.rows, [freshProfile()]);
});

test("conflicting email binding aborts before profile mutation", async () => {
  const authUser = { id: "auth-a", email: "admin@example.test", user_metadata: {} };
  const conflicting = freshProfile({ id: "other-profile", supabase_uid: "auth-other" });
  const fixture = bootstrapDouble({ authUser, profiles: [conflicting] });
  await assert.rejects(ensureBootstrapUser(fixture.supabase, config), /different auth user/);
  assert.equal(fixture.operations.some(({ table }) => table === "usuario"), false);
  assert.deepEqual(fixture.rows, [conflicting]);
});

test("bootstrap rejects zero or multiple target companies without promotion", async () => {
  for (const companies of [[], [{ id: "company-a" }, { id: "company-a" }]]) {
    const authUser = { id: "auth-a", email: "admin@example.test", user_metadata: {} };
    const fixture = bootstrapDouble({ authUser, profiles: [freshProfile()], companies });
    await assert.rejects(ensureBootstrapUser(fixture.supabase, config), /company.*exactly once/i);
    assert.equal(fixture.operations.some(({ action }) => action === "createAuth" || action === "updateAuth"), false);
    assert.equal(fixture.operations.some(({ table, action }) => table === "usuario" && action === "update"), false);
  }
});

test("reserved profile email aborts before Auth creation", async () => {
  const conflicting = freshProfile({ supabase_uid: "auth-other" });
  const fixture = bootstrapDouble({ authUser: null, profiles: [conflicting] });
  await assert.rejects(ensureBootstrapUser(fixture.supabase, config), /already reserves/);
  assert.equal(fixture.operations.some(({ action }) => action === "createAuth" || action === "updateAuth"), false);
  assert.equal(fixture.operations.some(({ table, action }) => table === "usuario" && action === "update"), false);
});

test("duplicate UID profiles abort without promotion", async () => {
  const authUser = { id: "auth-a", email: "admin@example.test", user_metadata: {} };
  const fixture = bootstrapDouble({ authUser, profiles: [freshProfile(), freshProfile({ id: "profile-b" })] });
  await assert.rejects(ensureBootstrapUser(fixture.supabase, config), /Conflicting public.usuario rows/);
  assert.equal(fixture.operations.some(({ table, action }) => table === "usuario" && action === "update"), false);
});
