import assert from "node:assert/strict";
import test from "node:test";

import { generateCredentialKeyPair, openCredential } from "../src/lib/mercadoPagoCredentials.ts";
import {
  exitCodeFor,
  formatKeygenOutput,
  formatSetOutput,
  OperationError,
  parseArgs,
  runKeygen,
  runSet,
  UsageError,
} from "./lib/mp-credentials.mjs";

const EMPRESA_ID = "11111111-1111-4111-8111-111111111111";
const ACCESS_TOKEN = "super-secret-access-token";
const WEBHOOK_SECRET = "super-secret-webhook-secret";

function fakePath() {
  return {
    resolve: (...parts) => parts.reduce((acc, part) => (part.startsWith("/") ? part : `${acc}/${part}`), ""),
    join: (...parts) => parts.join("/"),
    sep: "/",
  };
}

function fakeFs(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  const dirs = new Set(["/repo", "/outside"]);
  const calls = { writeFile: [], chmod: [], rm: [], mkdtemp: 0 };
  return {
    calls,
    files,
    async stat(target) {
      if (dirs.has(target)) return { isDirectory: () => true };
      if (files.has(target)) return { isDirectory: () => false };
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    },
    async readFile(target) {
      if (!files.has(target)) throw new Error(`missing file: ${target}`);
      return files.get(target).content;
    },
    async writeFile(target, data, options) {
      calls.writeFile.push({ target, data, mode: options?.mode });
      files.set(target, { content: data, mode: options?.mode });
    },
    async chmod(target, mode) {
      calls.chmod.push({ target, mode });
      if (files.has(target)) files.set(target, { ...files.get(target), mode });
    },
    async rm(target) {
      calls.rm.push(target);
      files.delete(target);
    },
    async mkdtemp() {
      calls.mkdtemp += 1;
      const dir = `/tmp/mp-credentials-${calls.mkdtemp}`;
      dirs.add(dir);
      return dir;
    },
  };
}

function fetchReturning(status, body) {
  return async () => ({ status, json: async () => body });
}

function usersMeBody(overrides = {}) {
  return { id: 42, site_id: "MLU", ...overrides };
}

function successfulRunSql(calls) {
  return async (args) => {
    calls.push(args);
    return { code: 0, stdout: "[]", stderr: "" };
  };
}

async function setFixture(overrides = {}) {
  const pair = generateCredentialKeyPair();
  const fs = fakeFs({ "/keys/public.pem": { content: pair.publicKeyPem } });
  const runSqlCalls = [];
  const options = {
    empresaId: EMPRESA_ID,
    liveMode: true,
    keyVersion: 1,
    publicKeyFile: "/keys/public.pem",
    target: "local",
    projectRef: null,
    readStdinLines: async () => [ACCESS_TOKEN, WEBHOOK_SECRET],
    fetchImpl: fetchReturning(200, usersMeBody()),
    runSql: successfulRunSql(runSqlCalls),
    fs,
    ...overrides,
  };
  return { options, fs, runSqlCalls, pair };
}

test("parseArgs: usage errors exit with code 2", () => {
  const usageCases = [
    [],
    ["bogus"],
    ["keygen", "--unknown-flag", "x"],
    ["keygen", "--out-dir"],
    ["keygen", "--out-dir", "/x"],
    ["set", "--empresa", EMPRESA_ID, "--mode", "live", "--key-version", "1", "--public-key-file", "/k", "--target", "linked"],
    ["set", "--empresa", EMPRESA_ID, "--mode", "live", "--key-version", "1", "--public-key-file", "/k", "--target", "local", "--project-ref", "abc"],
    ["set", "--empresa", EMPRESA_ID, "--mode", "live", "--key-version", "1", "--public-key-file", "/k", "--target", "local", "--access-token", "x"],
    ["set", "--empresa", EMPRESA_ID, "--mode", "live", "--key-version", "1", "--public-key-file", "/k", "--target", "local", "--secret", "x"],
  ];
  for (const argv of usageCases) {
    assert.throws(() => parseArgs(argv), UsageError, JSON.stringify(argv));
  }
  for (const argv of usageCases) {
    try {
      parseArgs(argv);
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(exitCodeFor(error), 2, JSON.stringify(argv));
    }
  }
});

test("parseArgs: a well-formed set command is accepted for local and linked targets", () => {
  const local = parseArgs([
    "set", "--empresa", EMPRESA_ID, "--mode", "test", "--key-version", "2",
    "--public-key-file", "/keys/public.pem", "--target", "local",
  ]);
  assert.deepEqual(local, {
    command: "set", empresaId: EMPRESA_ID, liveMode: false, keyVersion: 2,
    publicKeyFile: "/keys/public.pem", target: "local", projectRef: null,
  });

  const linked = parseArgs([
    "set", "--empresa", EMPRESA_ID, "--mode", "live", "--key-version", "1",
    "--public-key-file", "/keys/public.pem", "--target", "linked", "--project-ref", "my-ref",
  ]);
  assert.equal(linked.target, "linked");
  assert.equal(linked.projectRef, "my-ref");
});

test("runSet: stdin with fewer or more than two non-empty lines exits 1 without calling the SQL runner", async () => {
  for (const lines of [[ACCESS_TOKEN], [ACCESS_TOKEN, "", WEBHOOK_SECRET, "extra"], [], ["", ""]]) {
    const { options, runSqlCalls } = await setFixture({ readStdinLines: async () => lines });
    await assert.rejects(
      () => runSet(options),
      (error) => {
        assert.ok(error instanceof OperationError);
        assert.equal(exitCodeFor(error), 1);
        return true;
      },
    );
    assert.deepEqual(runSqlCalls, []);
  }
});

test("runSet: a non-200 /users/me response exits 1 naming the check without calling the SQL runner", async () => {
  const { options, runSqlCalls } = await setFixture({ fetchImpl: fetchReturning(401, {}) });
  await assert.rejects(() => runSet(options), (error) => {
    assert.ok(error instanceof OperationError);
    assert.equal(error.code, "mercadopago_users_me_not_ok");
    return true;
  });
  assert.deepEqual(runSqlCalls, []);
});

test("runSet: a missing or invalid id exits 1 naming the check without calling the SQL runner", async () => {
  for (const body of [usersMeBody({ id: undefined }), usersMeBody({ id: 0 }), usersMeBody({ id: -3 }), usersMeBody({ id: "42" })]) {
    const { options, runSqlCalls } = await setFixture({ fetchImpl: fetchReturning(200, body) });
    await assert.rejects(() => runSet(options), (error) => {
      assert.equal(error.code, "mercadopago_users_me_invalid_id");
      return true;
    });
    assert.deepEqual(runSqlCalls, []);
  }
});

test("runSet: a site_id other than MLU exits 1 naming the check without calling the SQL runner", async () => {
  const { options, runSqlCalls } = await setFixture({ fetchImpl: fetchReturning(200, usersMeBody({ site_id: "MLB" })) });
  await assert.rejects(() => runSet(options), (error) => {
    assert.equal(error.code, "mercadopago_users_me_invalid_site");
    return true;
  });
  assert.deepEqual(runSqlCalls, []);
});

test("runSet: success prints only the documented fields and the SQL never contains the plaintext", async () => {
  const { options, fs, runSqlCalls, pair } = await setFixture();
  const result = await runSet(options);
  const lines = formatSetOutput(result);
  assert.deepEqual(lines, [
    `Company: ${EMPRESA_ID}`,
    "mp_user_id: 42",
    "live_mode: true",
    "key_version: 1",
    `Webhook path: ${result.webhookPath}`,
  ]);
  assert.match(result.webhookPath, /^\/api\/webhooks\/mercadopago\/[A-Za-z0-9_-]{43}$/);

  assert.equal(runSqlCalls.length, 1);
  const sqlFilePath = runSqlCalls[0].sqlFilePath;
  const sqlContent = fs.calls.writeFile.find((call) => call.target === sqlFilePath).data;
  assert.ok(!sqlContent.includes(ACCESS_TOKEN));
  assert.ok(!sqlContent.includes(WEBHOOK_SECRET));
  assert.ok(!JSON.stringify(lines).includes(ACCESS_TOKEN));
  assert.ok(!JSON.stringify(lines).includes(WEBHOOK_SECRET));

  const tokenMatch = sqlContent.match(/'(v1:[^']+)',\s*'(v1:[^']+)'/);
  assert.ok(tokenMatch, "SQL must carry the two sealed ciphertexts");
  const openedToken = openCredential({
    privateKeyPem: pair.privateKeyPem, sealed: tokenMatch[1], empresaId: EMPRESA_ID, field: "access_token", keyVersion: 1,
  });
  const openedSecret = openCredential({
    privateKeyPem: pair.privateKeyPem, sealed: tokenMatch[2], empresaId: EMPRESA_ID, field: "webhook_secret", keyVersion: 1,
  });
  assert.equal(openedToken, ACCESS_TOKEN);
  assert.equal(openedSecret, WEBHOOK_SECRET);
});

test("runSet: the temp SQL file is 0600 in a 0700 directory and deleted on success", async () => {
  const { options, fs } = await setFixture();
  await runSet(options);
  assert.equal(fs.calls.mkdtemp, 1);
  const dirChmod = fs.calls.chmod.find((c) => c.mode === 0o700);
  assert.ok(dirChmod, "temp directory must be chmod 0700");
  const fileChmod = fs.calls.chmod.find((c) => c.mode === 0o600);
  assert.ok(fileChmod, "SQL file must be chmod 0600");
  assert.equal(fs.calls.rm.length, 2, "both the file and the directory must be removed");
  assert.equal(fs.files.size, 1, "only the untouched public key fixture remains");
});

test("runSet: the temp SQL file is deleted even when the SQL runner fails", async () => {
  const { options, fs } = await setFixture({ runSql: async () => ({ code: 1, stdout: "", stderr: "boom" }) });
  await assert.rejects(() => runSet(options));
  assert.equal(fs.calls.rm.length, 2);
  assert.equal(fs.files.size, 1);
});

test("runSet: an existing row for the company maps to credenciales_ya_configuradas", async () => {
  const { options } = await setFixture({
    runSql: async () => ({ code: 1, stdout: "{\"_tag\":\"Error\",\"error\":{\"message\":\"duplicate key value violates unique constraint \\\"empresa_mercadopago_pkey\\\"\"}}", stderr: "" }),
  });
  await assert.rejects(() => runSet(options), (error) => {
    assert.equal(error.code, "credenciales_ya_configuradas");
    assert.equal(exitCodeFor(error), 1);
    return true;
  });
});

test("runSet: an account already attached to another store maps to cuenta_ya_asociada", async () => {
  const { options } = await setFixture({
    runSql: async () => ({ code: 1, stdout: "{\"_tag\":\"Error\",\"error\":{\"message\":\"duplicate key value violates unique constraint \\\"empresa_mercadopago_mp_user_id_live_mode_key\\\"\"}}", stderr: "" }),
  });
  await assert.rejects(() => runSet(options), (error) => {
    assert.equal(error.code, "cuenta_ya_asociada");
    return true;
  });
});

test("runKeygen: refuses a directory inside the repository", async () => {
  const fs = fakeFs();
  await assert.rejects(
    () => runKeygen({ outDir: "/repo/keys", keyVersion: 1, fs, path: fakePath(), repoRoot: "/repo" }),
    (error) => {
      assert.ok(error instanceof OperationError);
      assert.equal(error.code, "out_dir_inside_repository");
      return true;
    },
  );
});

test("runKeygen: refuses a missing directory", async () => {
  const fs = fakeFs();
  await assert.rejects(
    () => runKeygen({ outDir: "/does-not-exist", keyVersion: 1, fs, path: fakePath(), repoRoot: "/repo" }),
    (error) => {
      assert.equal(error.code, "out_dir_missing");
      return true;
    },
  );
});

test("runKeygen: refuses to overwrite existing key files", async () => {
  const fs = fakeFs({ "/outside/mercadopago-credentials-v1.public.pem": { content: "existing" } });
  await assert.rejects(
    () => runKeygen({ outDir: "/outside", keyVersion: 1, fs, path: fakePath(), repoRoot: "/repo" }),
    (error) => {
      assert.equal(error.code, "key_file_exists");
      return true;
    },
  );
});

test("runKeygen: writes 0644/0600 files and prints only the two paths", async () => {
  const fs = fakeFs();
  const result = await runKeygen({ outDir: "/outside", keyVersion: 3, fs, path: fakePath(), repoRoot: "/repo" });
  assert.equal(result.publicPath, "/outside/mercadopago-credentials-v3.public.pem");
  assert.equal(result.privatePath, "/outside/mercadopago-credentials-v3.private.pem");
  assert.equal(fs.files.get(result.publicPath).mode, 0o644);
  assert.equal(fs.files.get(result.privatePath).mode, 0o600);

  const lines = formatKeygenOutput(result);
  assert.deepEqual(lines, [result.publicPath, result.privatePath]);
  assert.ok(!lines.join("\n").includes("BEGIN PRIVATE KEY"));
});
