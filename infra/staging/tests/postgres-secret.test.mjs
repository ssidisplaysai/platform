import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";
import { writePostgresAppSecretPayload } from "../create-postgres-app-secret-payload.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const helperPath = resolve(repoRoot, "infra/staging/create-postgres-app-secret.sh");

test("PostgreSQL secret payload uses a 256-bit random hex password and restrictive file mode", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "postgres-secret-payload-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const payloadPath = join(directory, "secret.json");

  await writePostgresAppSecretPayload(payloadPath, "genesis_app", "genesis_staging");
  const payload = JSON.parse(await readFile(payloadPath, "utf8"));

  assert.equal(payload.username, "genesis_app");
  assert.equal(payload.database, "genesis_staging");
  assert.match(payload.password, /^[a-f0-9]{64}$/);
  if (process.platform !== "win32") {
    const { mode } = await import("node:fs/promises").then(({ stat }) => stat(payloadPath));
    assert.equal(mode & 0o777, 0o600);
  }
  await assert.rejects(
    writePostgresAppSecretPayload(payloadPath, "genesis_app", "genesis_staging"),
    { code: "EEXIST" },
  );
});

for (const awsExitCode of [0, 1]) {
  test(`secret helper passes a file payload to AWS and cleans up after exit ${awsExitCode}`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "postgres-secret-helper-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const binDirectory = join(directory, "bin");
    await mkdir(binDirectory);
    const mockAwsPath = join(binDirectory, process.platform === "win32" ? "aws" : "aws");
    const mockAws = `#!/usr/bin/env bash
set -euo pipefail
node "$MOCK_AWS_SCRIPT" "$@"
exit "$MOCK_AWS_EXIT"
`;
    await writeFile(mockAwsPath, mockAws, { mode: 0o700 });
    await chmod(mockAwsPath, 0o700);
    const mockAwsScript = join(directory, "mock-aws.mjs");
    await writeFile(mockAwsScript, `
import { readFile, stat, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const payloadUri = value("--secret-string");
if (args[0] !== "secretsmanager" || args[1] !== "create-secret" ||
    !payloadUri?.startsWith("file://") ||
    args.includes("--generate-secret-string") ||
    args.includes("put-secret-value") ||
    value("--name") !== "genesis/staging/postgres" ||
    value("--description") !== "Genesis staging PostgreSQL app credentials" ||
    value("--tags") !== "Key=Environment,Value=staging") {
  throw new Error("unexpected Secrets Manager CLI arguments");
}
const payloadPath = payloadUri.slice("file://".length);
const payload = JSON.parse(await readFile(payloadPath, "utf8"));
const metadata = await stat(payloadPath);
await writeFile(process.env.MOCK_AWS_AUDIT, JSON.stringify({
  args, payloadPath, payload, mode: metadata.mode & 0o777,
}));
`);

    const bash = process.platform === "win32"
      ? "C:\\Program Files\\Git\\bin\\bash.exe"
      : "bash";
    const auditPath = join(directory, "audit.json");
    const result = spawnSync(bash, [helperPath,
      "genesis/staging/postgres",
      "Genesis staging PostgreSQL app credentials",
      "genesis_app",
      "genesis_staging"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
        MOCK_AWS_AUDIT: auditPath,
        MOCK_AWS_EXIT: String(awsExitCode),
        MOCK_AWS_SCRIPT: mockAwsScript,
        TMPDIR: directory,
      },
    });

    if (result.error?.code === "ENOENT") {
      t.skip("Bash is unavailable for the helper integration test");
      return;
    }
    assert.equal(result.status, awsExitCode === 0 ? 0 : 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /[a-f0-9]{64}/);
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    assert.equal(audit.payload.username, "genesis_app");
    assert.equal(audit.payload.database, "genesis_staging");
    assert.match(audit.payload.password, /^[a-f0-9]{64}$/);
    if (process.platform !== "win32") assert.equal(audit.mode, 0o600);
    assert.match(audit.payloadPath.replaceAll("\\", "/"),
      /\/genesis-staging-postgres-secret\.[^/]+\/secret\.json$/);
    assert.doesNotMatch(audit.payloadPath.replaceAll("\\", "/"), /Genesis V2\/platform/i);
    assert.deepEqual(
      (await readdir(directory)).filter((entry) => entry.startsWith("genesis-staging-postgres-secret.")),
      [],
    );
  });
}
