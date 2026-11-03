import { randomBytes as nodeRandomBytes } from "node:crypto";

import { generateCredentialKeyPair, sealCredential } from "../../src/lib/mercadoPagoCredentials.ts";

// Core logic for the mp:credentials operator command (odd/tasks/mercadopago-per-store.md,
// "G6-1 implementation specs", C3). Every IO boundary (stdin, fetch, the SQL
// runner, the filesystem) is injected so this module never touches the
// network or a real process on its own; scripts/mp-credentials.mjs wires the
// real implementations.

export class UsageError extends Error {
  constructor(code) {
    super(code);
    this.name = "UsageError";
    this.code = code;
  }
}

export class OperationError extends Error {
  constructor(code) {
    super(code);
    this.name = "OperationError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_SECRET_FLAGS = new Set([
  "--access-token", "--token", "--webhook-secret", "--secret", "--password",
]);

export function exitCodeFor(error) {
  if (error instanceof UsageError) return 2;
  return 1;
}

export function parseArgs(argv) {
  if (argv.length === 0) throw new UsageError("missing_command");
  const [command, ...rest] = argv;
  if (command !== "keygen" && command !== "set") throw new UsageError(`unknown_command:${command}`);

  const flagKeys = command === "keygen"
    ? { "--out-dir": "outDir", "--key-version": "keyVersion" }
    : {
      "--empresa": "empresa",
      "--mode": "mode",
      "--key-version": "keyVersion",
      "--public-key-file": "publicKeyFile",
      "--target": "target",
      "--project-ref": "projectRef",
    };

  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (FORBIDDEN_SECRET_FLAGS.has(flag)) throw new UsageError(`secret_flag_rejected:${flag}`);
    const key = flagKeys[flag];
    if (!key) throw new UsageError(`unknown_flag:${flag}`);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`missing_value:${flag}`);
    options[key] = value;
    i += 1;
  }

  if (command === "keygen") {
    for (const required of ["outDir", "keyVersion"]) {
      if (options[required] === undefined) throw new UsageError(`missing_flag:--${required === "outDir" ? "out-dir" : "key-version"}`);
    }
    const keyVersion = toPositiveInteger(options.keyVersion);
    if (keyVersion === null) throw new UsageError("invalid_key_version");
    return { command, outDir: options.outDir, keyVersion };
  }

  const requiredFlags = {
    empresa: "--empresa", mode: "--mode", keyVersion: "--key-version",
    publicKeyFile: "--public-key-file", target: "--target",
  };
  for (const [key, flag] of Object.entries(requiredFlags)) {
    if (options[key] === undefined) throw new UsageError(`missing_flag:${flag}`);
  }
  if (!UUID_PATTERN.test(options.empresa)) throw new UsageError("invalid_empresa");
  if (options.mode !== "live" && options.mode !== "test") throw new UsageError("invalid_mode");
  const keyVersion = toPositiveInteger(options.keyVersion);
  if (keyVersion === null) throw new UsageError("invalid_key_version");
  if (options.target !== "local" && options.target !== "linked") throw new UsageError("invalid_target");
  if (options.target === "linked" && options.projectRef === undefined) throw new UsageError("missing_flag:--project-ref");
  if (options.target === "local" && options.projectRef !== undefined) throw new UsageError("unexpected_flag:--project-ref");

  return {
    command,
    empresaId: options.empresa,
    liveMode: options.mode === "live",
    keyVersion,
    publicKeyFile: options.publicKeyFile,
    target: options.target,
    projectRef: options.projectRef ?? null,
  };
}

function toPositiveInteger(value) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function pathExists(fs, candidate) {
  return fs.stat(candidate).then(() => true, () => false);
}

export async function runKeygen({ outDir, keyVersion, fs, path, repoRoot }) {
  const resolved = path.resolve(outDir);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const isInsideRepo = resolved === resolvedRepoRoot || resolved.startsWith(`${resolvedRepoRoot}${path.sep}`);
  if (isInsideRepo) throw new OperationError("out_dir_inside_repository");

  const outDirStat = await fs.stat(resolved).catch(() => null);
  if (!outDirStat || !outDirStat.isDirectory()) throw new OperationError("out_dir_missing");

  const publicPath = path.join(resolved, `mercadopago-credentials-v${keyVersion}.public.pem`);
  const privatePath = path.join(resolved, `mercadopago-credentials-v${keyVersion}.private.pem`);
  if (await pathExists(fs, publicPath) || await pathExists(fs, privatePath)) {
    throw new OperationError("key_file_exists");
  }

  const { publicKeyPem, privateKeyPem } = generateCredentialKeyPair();
  await fs.writeFile(publicPath, publicKeyPem, { mode: 0o644 });
  await fs.chmod(publicPath, 0o644);
  await fs.writeFile(privatePath, privateKeyPem, { mode: 0o600 });
  await fs.chmod(privatePath, 0o600);

  return { publicPath, privatePath };
}

function sqlLiteral(value) {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildInsertSql({ empresaId, mpUserId, liveMode, webhookKey, accessTokenEnc, webhookSecretEnc, keyVersion }) {
  const columns = ["empresa_id", "mp_user_id", "live_mode", "webhook_key", "access_token_enc", "webhook_secret_enc", "key_version"];
  const values = [empresaId, mpUserId, liveMode, webhookKey, accessTokenEnc, webhookSecretEnc, keyVersion];
  return `insert into public.empresa_mercadopago (${columns.join(", ")}) values (${values.map(sqlLiteral).join(", ")});\n`;
}

export async function runSet({
  empresaId, liveMode, keyVersion, publicKeyFile, target, projectRef,
  readStdinLines, fetchImpl, runSql, fs, randomBytesImpl = nodeRandomBytes,
}) {
  const rawLines = await readStdinLines();
  const nonEmpty = rawLines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (nonEmpty.length !== 2) throw new OperationError("stdin_line_count");
  const [accessToken, webhookSecret] = nonEmpty;

  const publicKeyPem = await fs.readFile(publicKeyFile, "utf8");

  const response = await fetchImpl("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status !== 200) throw new OperationError("mercadopago_users_me_not_ok");
  const body = await response.json();
  if (!Number.isInteger(body?.id) || body.id <= 0) throw new OperationError("mercadopago_users_me_invalid_id");
  if (body?.site_id !== "MLU") throw new OperationError("mercadopago_users_me_invalid_site");

  const mpUserId = body.id;
  const webhookKey = randomBytesImpl(32).toString("base64url");
  const accessTokenEnc = sealCredential({
    publicKeyPem, plaintext: accessToken, empresaId, field: "access_token", keyVersion,
  });
  const webhookSecretEnc = sealCredential({
    publicKeyPem, plaintext: webhookSecret, empresaId, field: "webhook_secret", keyVersion,
  });

  const sql = buildInsertSql({ empresaId, mpUserId, liveMode, webhookKey, accessTokenEnc, webhookSecretEnc, keyVersion });

  const tmpDir = await fs.mkdtemp();
  await fs.chmod(tmpDir, 0o700);
  const sqlFile = `${tmpDir}/mp-credentials-insert.sql`;
  try {
    await fs.writeFile(sqlFile, sql, { mode: 0o600 });
    await fs.chmod(sqlFile, 0o600);
    const result = await runSql({ sqlFilePath: sqlFile, target, projectRef });
    if (result.code !== 0) {
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      if (/empresa_mercadopago_pkey/.test(output)) throw new OperationError("credenciales_ya_configuradas");
      if (/empresa_mercadopago_mp_user_id_live_mode_key/.test(output)) throw new OperationError("cuenta_ya_asociada");
      throw new OperationError("insert_failed");
    }
  } finally {
    await fs.rm(sqlFile).catch(() => {});
    await fs.rm(tmpDir, { recursive: true }).catch(() => {});
  }

  return {
    empresaId,
    mpUserId,
    liveMode,
    keyVersion,
    webhookPath: `/api/webhooks/mercadopago/${webhookKey}`,
  };
}

export function formatKeygenOutput({ publicPath, privatePath }) {
  return [publicPath, privatePath];
}

export function formatSetOutput({ empresaId, mpUserId, liveMode, keyVersion, webhookPath }) {
  return [
    `Company: ${empresaId}`,
    `mp_user_id: ${mpUserId}`,
    `live_mode: ${liveMode}`,
    `key_version: ${keyVersion}`,
    `Webhook path: ${webhookPath}`,
  ];
}
