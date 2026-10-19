import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { shouldRollbackCandidate } from "../rollback-race-guard.mjs";

test("shouldRollbackCandidate returns true only when live task definition matches workflow candidate", () => {
  const candidate = "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:13";
  assert.equal(shouldRollbackCandidate({ currentTaskDefinition: candidate, candidateTaskDefinition: candidate }), true);
  assert.equal(shouldRollbackCandidate({
    currentTaskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:14",
    candidateTaskDefinition: candidate,
  }), false);
});

test("CLI exits with race-protection code when a newer task definition is active", () => {
  const script = resolve(import.meta.dirname, "../rollback-race-guard.mjs");
  const result = spawnSync(process.execPath, [
    script,
    "--current",
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:14",
    "--candidate",
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:13",
  ], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /ROLLBACK_SAFE=false/);
});
