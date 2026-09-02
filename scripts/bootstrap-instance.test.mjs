import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

const tenantDomainModule = await import("./lib/tenant-domain.mjs").catch(() => ({}));

function requireApi(name) {
  assert.equal(typeof tenantDomainModule[name], "function", `bootstrap domain API ${name} must exist`);
  return tenantDomainModule[name];
}

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";

test("canonical APP_BASE_URL hostname rejects Unicode before URL Punycode and reuses Host normalization", () => {
  const resolveHostname = requireApi("resolveCanonicalHostname");
  assert.equal(resolveHostname("http://localhost:3000"), "localhost");
  assert.equal(resolveHostname("https://SHOP.EXAMPLE.COM.:443"), "shop.example.com");
  assert.throws(() => resolveHostname("https://tést.example"), /ASCII/);
});

test("plain insert creates a mapping and reports non-secret state", async () => {
  const ensure = requireApi("ensureTenantDomain");
  const client = fakeDomainClient({ insert: { data: null, error: null } });
  assert.deepEqual(await ensure(client, "shop.test", tenantA), { hostname: "shop.test", created: true });
  assert.deepEqual(client.operations, [{ operation: "insert", value: { hostname: "shop.test", empresa_id: tenantA } }]);
});

test("23505 is idempotent for the same owner and collision-safe for another owner", async () => {
  const ensure = requireApi("ensureTenantDomain");
  const same = fakeDomainClient({ insert: { data: null, error: { code: "23505" } }, owner: tenantA });
  assert.deepEqual(await ensure(same, "shop.test", tenantA), { hostname: "shop.test", created: false });
  assert.ok(!same.operations.some((entry) => ["update", "upsert"].includes(entry.operation)));

  const collision = fakeDomainClient({ insert: { data: null, error: { code: "23505" } }, owner: tenantB });
  await assert.rejects(() => ensure(collision, "shop.test", tenantA), /already belongs to another company/);
  assert.equal(collision.owner, tenantB);
  assert.ok(!collision.operations.some((entry) => ["update", "upsert"].includes(entry.operation)));
});

test("non-unique insert and ownership-read errors propagate", async () => {
  const ensure = requireApi("ensureTenantDomain");
  const insertError = new Error("registry unavailable");
  await assert.rejects(() => ensure(fakeDomainClient({ insert: { data: null, error: insertError } }), "shop.test", tenantA), insertError);
  const readError = new Error("ownership read failed");
  await assert.rejects(() => ensure(fakeDomainClient({ insert: { data: null, error: { code: "23505" } }, readError }), "shop.test", tenantA), readError);
});

test("bootstrap JSON reports canonical hostname for created and already-present domain states", () => {
  const hostname = `gate2-r4-${randomUUID().slice(0, 8)}.localhost`;
  const env = { ...process.env, APP_BASE_URL: `http://${hostname}:3000` };

  try {
    const created = runBootstrapAndParseJson(env);
    assert.deepEqual(created.tenant_domain, { hostname, created: true });
    assert.deepEqual(Object.keys(created.tenant_domain).sort(), ["created", "hostname"]);

    const alreadyPresent = runBootstrapAndParseJson(env);
    assert.deepEqual(alreadyPresent.tenant_domain, { hostname, created: false });
    assert.deepEqual(Object.keys(alreadyPresent.tenant_domain).sort(), ["created", "hostname"]);
  } finally {
    execFileSync(
      "docker",
      ["exec", "supabase_db_ecommerce", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", `delete from public.empresa_dominio where hostname = '${hostname}'`],
      { stdio: "ignore" },
    );
  }
});

function runBootstrapAndParseJson(env) {
  const result = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/bootstrap-instance.mjs"],
    { cwd: process.cwd(), env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const marker = "[instance-bootstrap] OK\n";
  const markerIndex = result.stdout.indexOf(marker);
  assert.notEqual(markerIndex, -1, result.stdout);
  return JSON.parse(result.stdout.slice(markerIndex + marker.length));
}

function fakeDomainClient(options) {
  const operations = [];
  const client = {
    operations,
    owner: options.owner,
    from(table) {
      assert.equal(table, "empresa_dominio");
      return {
        async insert(value) { operations.push({ operation: "insert", value }); return options.insert; },
        select() {
          const query = {
            eq(key, value) { operations.push({ operation: "select-eq", value: { key, value } }); return query; },
            async single() {
              if (options.readError) return { data: null, error: options.readError };
              return { data: { empresa_id: options.owner }, error: null };
            },
          };
          return query;
        },
      };
    },
  };
  return client;
}
