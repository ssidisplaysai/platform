import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = resolve(import.meta.dirname, "staging-s2g-db-admin-invoke-request-prepare.ps1");
const isWindows = process.platform === "win32";

function runPrepare({ outputPath, runId }) {
  if (!isWindows) return { status: 0, stdout: "", stderr: "" };
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-OutputPath",
    outputPath,
    "-RunId",
    runId,
  ];
  const result = spawnSync("powershell.exe", args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

async function withTempDir(fn) {
  const directory = await mkdtemp(resolve(tmpdir(), "s2g-db-admin-invoke-body-"));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (!isWindows) {
  test("PowerShell request-body preparation tests require Windows", { skip: true }, () => {});
} else {
  test("writes runId-only invocation body as UTF-8 without BOM", async () => {
    await withTempDir(async (directory) => {
      const outputPath = resolve(directory, "invoke-request.json");
      const runId = "s2g-dbdiag-offline-body-abc123";
      const result = runPrepare({ outputPath, runId });
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(outputPath);
      assert.notDeepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
      const parsed = JSON.parse(bytes.toString("utf8"));
      assert.deepEqual(Object.keys(parsed), ["runId"]);
      assert.equal(parsed.runId, runId);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.outputHasUtf8Bom, false);
      assert.equal(summary.payloadOnlyRunId, true);
    });
  });

  test("fails closed when runId format is invalid", async () => {
    await withTempDir(async (directory) => {
      const outputPath = resolve(directory, "invoke-request.json");
      const result = runPrepare({ outputPath, runId: "invalid-run-id" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /INVOKE_BODY_RUN_ID_INVALID/);
    });
  });
}
