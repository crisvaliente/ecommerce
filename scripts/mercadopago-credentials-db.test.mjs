import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import * as fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCredentialKeyPair, openCredential } from "../src/lib/mercadoPagoCredentials.ts";
import {
  createCleanupRegistry,
  createTrackedCompany,
  loadGuardedLocalSupabase,
  runTrackedSetup,
} from "./lib/local-auth-fixtures.mjs";
import { runSet } from "./lib/mp-credentials.mjs";

// Run alone or with the other DB suites:
//   ALLOW_LOCAL_SUPABASE_MUTATIONS=1 node --test scripts/mercadopago-credentials-db.test.mjs
const { service } = loadGuardedLocalSupabase();

function sql(query) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_ecommerce", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atc", query],
    { encoding: "utf8" },
  ).trim();
}

function sqlExpectError(query) {
  try {
    execFileSync(
      "docker",
      ["exec", "supabase_db_ecommerce", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atc", query],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return null;
  } catch (error) {
    return error.stderr?.toString() ?? error.message ?? "unknown error";
  }
}

function webhookKey() {
  return randomBytes(32).toString("base64url");
}

function sealed(label) {
  return `v1:fixture-${label}`;
}

function insertRow(empresaId, overrides = {}) {
  const values = {
    empresa_id: empresaId,
    mp_user_id: 100000001,
    live_mode: true,
    webhook_key: webhookKey(),
    access_token_enc: sealed("token"),
    webhook_secret_enc: sealed("secret"),
    key_version: 1,
    ...overrides,
  };
  const columns = Object.keys(values);
  const literal = (value) => {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return String(value);
    return `'${value}'`;
  };
  const row = sql(
    `insert into public.empresa_mercadopago (${columns.join(",")}) values (${columns.map((c) => literal(values[c])).join(",")}) returning empresa_id`,
  );
  return row;
}

async function fixtureCompany(registry, label) {
  const empresaId = await createTrackedCompany(service, registry, label);
  registry.register(`empresa_mercadopago:${empresaId}`, async () => {
    sql(`delete from public.empresa_mercadopago where empresa_id = '${empresaId}'`);
  }, 400);
  return empresaId;
}

async function fixture() {
  const registry = createCleanupRegistry();
  return runTrackedSetup(registry, async () => {
    const empresaId = await fixtureCompany(registry, "mp-credentials");
    return { registry, empresaId };
  });
}

test("T1: no role but service_role has table privileges, and only select works through the service client", async () => {
  const privileges = sql(
    ["anon", "authenticated", "service_role"]
      .flatMap((role) => ["select", "insert", "update", "delete"].map(
        (privilege) => `select '${role}:${privilege}', has_table_privilege('${role}', 'public.empresa_mercadopago', '${privilege}')`,
      ))
      .join(" union all "),
  );
  assert.equal(
    privileges,
    [
      "anon:select|f", "anon:insert|f", "anon:update|f", "anon:delete|f",
      "authenticated:select|f", "authenticated:insert|f", "authenticated:update|f", "authenticated:delete|f",
      "service_role:select|t", "service_role:insert|f", "service_role:update|f", "service_role:delete|f",
    ].join("\n"),
  );

  const f = await fixture();
  try {
    insertRow(f.empresaId);
    const read = await service.from("empresa_mercadopago").select("empresa_id").eq("empresa_id", f.empresaId);
    assert.ifError(read.error);
    assert.equal(read.data.length, 1);

    const insertAttempt = await service.from("empresa_mercadopago").insert({
      empresa_id: randomUUID(), mp_user_id: 2, live_mode: true, webhook_key: webhookKey(),
      access_token_enc: sealed("x"), webhook_secret_enc: sealed("y"), key_version: 1,
    });
    assert.ok(insertAttempt.error, "service client must not be able to insert");

    const updateAttempt = await service.from("empresa_mercadopago").update({ estado: "inactivo" }).eq("empresa_id", f.empresaId);
    assert.ok(updateAttempt.error, "service client must not be able to update");

    const deleteAttempt = await service.from("empresa_mercadopago").delete().eq("empresa_id", f.empresaId);
    assert.ok(deleteAttempt.error, "service client must not be able to delete");
  } finally {
    await f.registry.cleanup();
  }
});

test("T1: RLS is enabled and forced with no policies", () => {
  assert.equal(
    sql("select relrowsecurity || ':' || relforcerowsecurity from pg_class where oid = 'public.empresa_mercadopago'::regclass"),
    "true:true",
  );
  assert.equal(
    sql("select count(*) from pg_policies where schemaname = 'public' and tablename = 'empresa_mercadopago'"),
    "0",
  );
});

test("T1: every check constraint rejects its invalid case with no row written", async () => {
  const f = await fixture();
  try {
    const cases = [
      { label: "mp_user_id zero", overrides: { mp_user_id: 0 } },
      { label: "mp_user_id negative", overrides: { mp_user_id: -5 } },
      { label: "webhook_key too short", overrides: { webhook_key: "short" } },
      { label: "webhook_key bad character", overrides: { webhook_key: `${"a".repeat(42)}!` } },
      { label: "access_token_enc missing prefix", overrides: { access_token_enc: "nope" } },
      { label: "webhook_secret_enc missing prefix", overrides: { webhook_secret_enc: "nope" } },
      { label: "key_version zero", overrides: { key_version: 0 } },
      { label: "key_version negative", overrides: { key_version: -1 } },
      { label: "estado invalid", overrides: { estado: "pendiente" } },
      {
        label: "previous secret present without valid_until",
        overrides: { previous_webhook_secret_enc: sealed("prev") },
      },
      {
        label: "previous secret missing prefix",
        overrides: {
          previous_webhook_secret_enc: "nope",
          previous_secret_valid_until: new Date().toISOString(),
        },
      },
    ];
    for (const { label, overrides } of cases) {
      const error = sqlExpectError(
        (() => {
          const values = {
            empresa_id: f.empresaId, mp_user_id: 100000002, live_mode: true, webhook_key: webhookKey(),
            access_token_enc: sealed("token"), webhook_secret_enc: sealed("secret"), key_version: 1,
            ...overrides,
          };
          const columns = Object.keys(values);
          const literal = (value) => (value === null ? "null" : typeof value === "boolean" ? (value ? "true" : "false") : typeof value === "number" ? String(value) : `'${value}'`);
          return `insert into public.empresa_mercadopago (${columns.join(",")}) values (${columns.map((c) => literal(values[c])).join(",")})`;
        })(),
      );
      assert.ok(error, `expected rejection for: ${label}`);
    }
    const count = sql(`select count(*) from public.empresa_mercadopago where empresa_id = '${f.empresaId}'`);
    assert.equal(count, "0", "no invalid row was written");

    const validWithPrevious = sqlExpectError(
      `insert into public.empresa_mercadopago (empresa_id, mp_user_id, live_mode, webhook_key, access_token_enc, webhook_secret_enc, key_version, previous_webhook_secret_enc, previous_secret_valid_until) values ('${f.empresaId}', 100000003, true, '${webhookKey()}', '${sealed("token")}', '${sealed("secret")}', 1, '${sealed("prev")}', now())`,
    );
    assert.equal(validWithPrevious, null, "a previous secret with a valid_until timestamp must be accepted");
  } finally {
    await f.registry.cleanup();
  }
});

test("T1: mp_user_id is unique per live_mode, allowing the same account once live and once test", async () => {
  const registry = createCleanupRegistry();
  try {
    const empresaA = await fixtureCompany(registry, "mp-unique-a");
    const empresaB = await fixtureCompany(registry, "mp-unique-b");
    const mpUserId = 555000111;
    insertRow(empresaA, { mp_user_id: mpUserId, live_mode: true });

    const collision = sqlExpectError(
      `insert into public.empresa_mercadopago (empresa_id, mp_user_id, live_mode, webhook_key, access_token_enc, webhook_secret_enc, key_version) values ('${empresaB}', ${mpUserId}, true, '${webhookKey()}', '${sealed("token")}', '${sealed("secret")}', 1)`,
    );
    assert.ok(collision, "the same account twice in live mode must be rejected");

    const testMode = sqlExpectError(
      `insert into public.empresa_mercadopago (empresa_id, mp_user_id, live_mode, webhook_key, access_token_enc, webhook_secret_enc, key_version) values ('${empresaB}', ${mpUserId}, false, '${webhookKey()}', '${sealed("token")}', '${sealed("secret")}', 1)`,
    );
    assert.equal(testMode, null, "the same account must be allowed once live and once test");
  } finally {
    await registry.cleanup();
  }
});

test("T1: deleting a company with a row is blocked by the foreign key", async () => {
  const registry = createCleanupRegistry();
  try {
    const empresaId = await createTrackedCompany(service, registry, "mp-fk-restrict");
    insertRow(empresaId);
    const error = sqlExpectError(`delete from public.empresa where id = '${empresaId}'`);
    assert.ok(error, "deleting a company that still has a credentials row must be blocked");
    sql(`delete from public.empresa_mercadopago where empresa_id = '${empresaId}'`);
  } finally {
    await registry.cleanup();
  }
});

test("T1: intento_pago and webhook_recepcion_mp gain nullable store-scoped columns without touching existing rows", async () => {
  const f = await fixture();
  try {
    const buyer = await service.auth.admin.createUser({
      id: randomUUID(), email: `mp-cols-${randomUUID()}@example.test`, email_confirm: true,
    });
    f.registry.register("auth.users", async () => {
      await service.auth.admin.deleteUser(buyer.data.user.id);
    }, 100);
    const { data: profile } = await service.from("usuario").select("id").eq("supabase_uid", buyer.data.user.id).single();
    f.registry.register("usuario", async () => {
      await service.from("usuario").delete().eq("id", profile.id);
    }, 300);
    const address = await service.from("direccion_usuario").insert({
      usuario_id: profile.id, direccion: "x", ciudad: "x", pais: "Uruguay", codigo_postal: "11111", tipo_direccion: "hogar",
    }).select("id").single();
    f.registry.register("direccion_usuario", async () => {
      await service.from("direccion_usuario").delete().eq("id", address.data.id);
    }, 350);

    const pedido = await service.from("pedido").insert({
      usuario_id: profile.id, empresa_id: f.empresaId, direccion_envio_id: address.data.id,
      estado: "pendiente_pago", total: 100, direccion_envio_snapshot: {},
      expira_en: new Date(Date.now() + 3600000).toISOString(),
    }).select("id").single();
    assert.ifError(pedido.error);
    f.registry.register("pedido_estado_evento", async () => {
      await service.from("pedido_estado_evento").delete().eq("empresa_id", f.empresaId);
    }, 365);
    f.registry.register("pedido", async () => {
      await service.from("pedido").delete().eq("id", pedido.data.id);
    }, 360);

    const before = await service.from("intento_pago").insert({
      pedido_id: pedido.data.id, empresa_id: f.empresaId, canal_pago: "mercadopago",
    }).select("id, mp_user_id").single();
    assert.ifError(before.error);
    assert.equal(before.data.mp_user_id, null, "existing rows gain the nullable column with no value");
    f.registry.register("intento_pago", async () => {
      await service.from("intento_pago").delete().eq("id", before.data.id);
    }, 370);

    const invalid = await service.from("intento_pago").update({ mp_user_id: 0 }).eq("id", before.data.id);
    assert.ok(invalid.error, "mp_user_id must be positive when present");
    const valid = await service.from("intento_pago").update({ mp_user_id: 42 }).eq("id", before.data.id).select("mp_user_id").single();
    assert.ifError(valid.error);
    assert.equal(valid.data.mp_user_id, 42);

    const receipt = await service.from("webhook_recepcion_mp").insert({
      x_request_id: randomUUID(), payment_id: randomUUID(), signature_ts: Math.floor(Date.now() / 1000),
      trace_id: randomUUID(), verification_mode: "signature",
    }).select("id, empresa_id").single();
    assert.ifError(receipt.error);
    assert.equal(receipt.data.empresa_id, null, "existing receipt rows gain the nullable column with no value");
    f.registry.register("webhook_recepcion_mp", async () => {
      sql(`delete from public.webhook_recepcion_mp where id = '${receipt.data.id}'`);
    }, 380);

    const stamped = await service.from("webhook_recepcion_mp").update({ empresa_id: f.empresaId }).eq("id", receipt.data.id).select("empresa_id").single();
    assert.ifError(stamped.error);
    assert.equal(stamped.data.empresa_id, f.empresaId);

    const foreignCompany = sqlExpectError(
      `update public.webhook_recepcion_mp set empresa_id = '${randomUUID()}' where id = '${receipt.data.id}'`,
    );
    assert.ok(foreignCompany, "empresa_id must reference an existing company");
  } finally {
    await f.registry.cleanup();
  }
});

function realRunSql({ sqlFilePath, target, projectRef }) {
  return new Promise((resolve) => {
    const args = ["db", "query", target === "local" ? "--local" : "--linked"];
    if (projectRef) args.push("--project-ref", projectRef);
    args.push("--output-format", "json", "-f", sqlFilePath);
    execFile("supabase", args, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

const realFs = {
  readFile: (target, encoding) => fsPromises.readFile(target, encoding),
  writeFile: (target, data, options) => fsPromises.writeFile(target, data, options),
  chmod: (target, mode) => fsPromises.chmod(target, mode),
  rm: (target, options) => fsPromises.rm(target, options),
  mkdtemp: () => fsPromises.mkdtemp(path.join(os.tmpdir(), "mp-credentials-e2e-")),
};

test("T3: an end-to-end `set --target local` writes a row whose ciphertexts open with the private key, and a second set for the same company exits credenciales_ya_configuradas without changes", async () => {
  const registry = createCleanupRegistry();
  try {
    const empresaId = await fixtureCompany(registry, "mp-cli-e2e");
    const pair = generateCredentialKeyPair();
    const publicKeyFile = path.join(os.tmpdir(), `mp-credentials-e2e-public-${randomUUID()}.pem`);
    await fsPromises.writeFile(publicKeyFile, pair.publicKeyPem);
    registry.register("public-key-file", async () => {
      await fsPromises.rm(publicKeyFile, { force: true });
    }, 450);

    const accessToken = "e2e-access-token";
    const webhookSecret = "e2e-webhook-secret";
    const mpUserId = randomInt(200000000, 299999999);
    const fetchImpl = async () => ({ status: 200, json: async () => ({ id: mpUserId, site_id: "MLU" }) });

    const setOptions = {
      empresaId, liveMode: true, keyVersion: 1, publicKeyFile, target: "local", projectRef: null,
      readStdinLines: async () => [accessToken, webhookSecret],
      fetchImpl, runSql: realRunSql, fs: realFs,
    };

    const result = await runSet(setOptions);
    assert.equal(result.mpUserId, mpUserId);
    assert.equal(result.liveMode, true);

    const row = sql(
      `select mp_user_id, live_mode, access_token_enc, webhook_secret_enc from public.empresa_mercadopago where empresa_id = '${empresaId}'`,
    );
    const [storedMpUserId, storedLiveMode, accessTokenEnc, webhookSecretEnc] = row.split("|");
    assert.equal(storedMpUserId, String(mpUserId));
    assert.equal(storedLiveMode, "t");
    assert.equal(
      openCredential({ privateKeyPem: pair.privateKeyPem, sealed: accessTokenEnc, empresaId, field: "access_token", keyVersion: 1 }),
      accessToken,
    );
    assert.equal(
      openCredential({ privateKeyPem: pair.privateKeyPem, sealed: webhookSecretEnc, empresaId, field: "webhook_secret", keyVersion: 1 }),
      webhookSecret,
    );

    await assert.rejects(
      () => runSet({ ...setOptions, readStdinLines: async () => ["other-token", "other-secret"] }),
      (error) => {
        assert.equal(error.code, "credenciales_ya_configuradas");
        return true;
      },
    );

    const unchanged = sql(
      `select mp_user_id, live_mode, access_token_enc, webhook_secret_enc from public.empresa_mercadopago where empresa_id = '${empresaId}'`,
    );
    assert.equal(unchanged, row, "a rejected second set must leave the row unchanged");
    assert.equal(sql(`select count(*) from public.empresa_mercadopago where empresa_id = '${empresaId}'`), "1");
  } finally {
    await registry.cleanup();
  }
});
