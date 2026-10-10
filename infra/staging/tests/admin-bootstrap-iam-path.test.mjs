import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(new URL("../aws-cli-file-path.sh", import.meta.url));
const windowsGitBash = `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Git\\bin\\bash.exe`;
const bash = process.env.BASH ?? (
  process.platform === "win32" && existsSync(windowsGitBash) ? windowsGitBash : "bash"
);

function runPathHelper(script, inputPath, env = {}) {
  const result = spawnSync(bash, ["-c", script, "aws-cli-path-test", helperPath, inputPath], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trimEnd();
}

test("POSIX paths remain unchanged outside Git Bash/MSYS/MINGW", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'Linux'; }; cygpath() { return 99; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/workspace/Genesis V2/infra/staging/policy.json",
  );
  assert.equal(result, "/workspace/Genesis V2/infra/staging/policy.json");
});

test("Git Bash paths are converted with cygpath -w when available", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; cygpath() { test \"$1\" = -w || return 2; shift; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\policy.json" },
  );
  assert.equal(result, "C:\\Users\\rober\\Documents\\Genesis V2\\policy.json");
});

test("Git Bash path remains unchanged when cygpath is unavailable", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; command() { if [[ \"$1\" = -v && \"$2\" = cygpath ]]; then return 1; fi; builtin command \"$@\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/policy.json",
  );
  assert.equal(result, "/c/Users/rober/Documents/Genesis V2/policy.json");
});

test("spaces in source and converted paths are preserved as one argument", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MSYS_NT-10.0'; }; cygpath() { test \"$#\" = 2 && test \"$1\" = -w && test \"$2\" = '/c/Users/rober/Documents/Genesis V2/platform/infra/staging/01 policy.json' || return 2; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_path \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/platform/infra/staging/01 policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\platform\\infra\\staging\\01 policy.json" },
  );
  assert.equal(
    result,
    "C:\\Users\\rober\\Documents\\Genesis V2\\platform\\infra\\staging\\01 policy.json",
  );
});

test("AWS CLI file URI is constructed from the converted path", () => {
  const result = runPathHelper(
    "unset MSYSTEM; uname() { printf 'MINGW64_NT-10.0'; }; cygpath() { test \"$1\" = -w || return 2; shift; printf '%s' \"$EXPECTED_WINDOWS_PATH\"; }; source \"$1\"; aws_cli_file_uri \"$2\"",
    "/c/Users/rober/Documents/Genesis V2/01 policy.json",
    { EXPECTED_WINDOWS_PATH: "C:\\Users\\rober\\Documents\\Genesis V2\\01 policy.json" },
  );
  assert.equal(result, "file://C:\\Users\\rober\\Documents\\Genesis V2\\01 policy.json");
});

test("admin IAM helper routes every AWS file URI through the shared converter", async () => {
  const { readFile } = await import("node:fs/promises");
  const helper = await readFile(new URL("../admin-bootstrap-iam.sh", import.meta.url), "utf8");
  assert.equal((helper.match(/file:\/\//g) ?? []).length, 0);
  assert.equal((helper.match(/aws_cli_file_uri "\$policy_file"/g) ?? []).length, 2);
});
