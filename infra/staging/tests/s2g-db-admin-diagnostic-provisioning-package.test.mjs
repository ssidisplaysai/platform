import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

async function readText(path) {
  return readFile(resolve(repoRoot, path), "utf8");
}

test("diagnostic execution role trust and runtime policy remain least-privilege", async () => {
  const trust = await readJson("infra/staging/iam/s2g-db-admin-diagnostic-execution-role-trust.json");
  assert.equal(trust.Statement.length, 1);
  assert.deepEqual(trust.Statement[0].Principal, { Service: "ecs-tasks.amazonaws.com" });
  assert.equal(trust.Statement[0].Action, "sts:AssumeRole");

  const runtime = await readJson("infra/staging/iam/s2g-db-admin-diagnostic-execution-runtime.json");
  const statements = runtime.Statement;
  const wildcardStatements = statements.filter((statement) =>
    JSON.stringify(statement.Resource) === "\"*\"");
  assert.equal(wildcardStatements.length, 1);
  assert.equal(wildcardStatements[0].Action, "ecr:GetAuthorizationToken");
  assert.ok(statements.some((statement) =>
    JSON.stringify(statement.Action).includes("secretsmanager:GetSecretValue")));
  assert.ok(!JSON.stringify(runtime).includes("genesis/production/"));
});

test("diagnostic task role has ECS task trust only and no runtime permissions", async () => {
  const trust = await readJson("infra/staging/iam/s2g-db-admin-diagnostic-task-role-trust.json");
  assert.equal(trust.Statement.length, 1);
  assert.deepEqual(trust.Statement[0].Principal, { Service: "ecs-tasks.amazonaws.com" });
  const runtime = await readJson("infra/staging/iam/s2g-db-admin-diagnostic-task-runtime.json");
  assert.deepEqual(runtime.Statement, []);
});

test("network boundary requires dedicated SG with zero ingress and scoped RDS egress", async () => {
  const plan = await readJson("infra/staging/s2g-db-admin-diagnostic-network.plan.json");
  assert.equal(plan.assignPublicIp, "DISABLED");
  assert.deepEqual(plan.proposedDiagnosticSecurityGroup.inboundRules, []);
  assert.equal(plan.proposedDiagnosticSecurityGroup.outboundRules.length, 1);
  assert.equal(plan.proposedDiagnosticSecurityGroup.outboundRules[0].toPort, 5432);
  assert.equal(plan.proposedDiagnosticSecurityGroup.outboundRules[0].destinationSecurityGroupId, "sg-04aa58230942f9dc9");
  assert.equal(plan.privateConnectivityFindings.vpcEndpoints.length, 0);
});

test("provisioning package phases remain isolated and keep launcher disabled during task ARN update", async () => {
  const pack = await readJson("infra/staging/s2g-db-admin-diagnostic-provisioning-package.json");
  assert.equal(pack.phases.length, 6);
  assert.deepEqual(pack.phases.map((phase) => phase.id), ["A", "B", "C", "D", "E", "F"]);
  const phaseF = pack.phases.find((phase) => phase.id === "F");
  assert.ok(phaseF.expectedOutputs.some((line) => line.includes("LauncherActivationState remains DISABLED")));
});

test("diagnostic dockerfile enforces pinned base digest and dedicated entrypoint", async () => {
  const dockerfile = await readText("infra/staging/Dockerfile.s2g-db-admin-diagnostic");
  assert.match(dockerfile, /NODE_RUNTIME_BASE must be pinned to an immutable digest/);
  assert.match(dockerfile, /ENTRYPOINT \["node", "scripts\/staging-s2g-db-admin-diagnostic\.mjs"\]/);
  assert.doesNotMatch(dockerfile, /aws cli|awscli/i);
});

