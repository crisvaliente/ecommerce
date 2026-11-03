import { execFile } from "node:child_process";
import * as fsPromises from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  exitCodeFor,
  formatKeygenOutput,
  formatSetOutput,
  parseArgs,
  runKeygen,
  runSet,
  UsageError,
} from "./lib/mp-credentials.mjs";

// Operator command: mp:credentials set|keygen (odd/tasks/mercadopago-per-store.md, C3).
// Secrets travel only through stdin, never as flags or environment variables.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readStdinLines() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").split("\n");
}

function runSupabaseSql({ sqlFilePath, target, projectRef }) {
  const args = ["db", "query", target === "local" ? "--local" : "--linked"];
  if (projectRef) args.push("--project-ref", projectRef);
  args.push("--output-format", "json", "-f", sqlFilePath);
  return new Promise((resolve) => {
    execFile("supabase", args, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

const fs = {
  stat: (p) => fsPromises.stat(p),
  readFile: (p, encoding) => fsPromises.readFile(p, encoding),
  writeFile: (p, data, options) => fsPromises.writeFile(p, data, options),
  chmod: (p, mode) => fsPromises.chmod(p, mode),
  rm: (p, options) => fsPromises.rm(p, options),
  mkdtemp: () => fsPromises.mkdtemp(path.join(os.tmpdir(), "mp-credentials-")),
};

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "keygen") {
    const keygenResult = await runKeygen({
      outDir: parsed.outDir, keyVersion: parsed.keyVersion, fs, path, repoRoot,
    });
    for (const line of formatKeygenOutput(keygenResult)) console.log(line);
    return;
  }

  const result = await runSet({
    empresaId: parsed.empresaId,
    liveMode: parsed.liveMode,
    keyVersion: parsed.keyVersion,
    publicKeyFile: parsed.publicKeyFile,
    target: parsed.target,
    projectRef: parsed.projectRef,
    readStdinLines,
    fetchImpl: fetch,
    runSql: runSupabaseSql,
    fs,
  });
  for (const line of formatSetOutput(result)) console.log(line);
}

main().catch((error) => {
  if (error instanceof UsageError) {
    console.error(`usage error: ${error.code}`);
  } else {
    console.error(error?.code ?? error?.message ?? "unknown error");
  }
  process.exit(exitCodeFor(error));
});
