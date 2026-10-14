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
  assert.equal(plan.dns.enableDnsSupport, true);
  assert.equal(plan.dns.enableDnsHostnames, true);
  assert.equal(plan.existingVpcEndpoints.length, 0);
  assert.equal(plan.recommendedArchitecture.selection, "B_nat_path");
  assert.equal(plan.architectures.A_private_endpoints.requiredEndpoints.length, 5);
  assert.ok(plan.architectures.B_nat_path.diagnosticSecurityGroupEgress.some((rule) =>
    rule.destinationSecurityGroupId === "sg-04aa58230942f9dc9" && rule.toPort === 5432));
  assert.ok(plan.architectures.B_nat_path.diagnosticSecurityGroupEgress.some((rule) =>
    rule.destinationCidrIpv4 === "0.0.0.0/0" && rule.toPort === 443));
});

test("provisioning package phases remain isolated and keep launcher disabled during task ARN update", async () => {
  const pack = await readJson("infra/staging/s2g-db-admin-diagnostic-provisioning-package.json");
  assert.equal(pack.prerequisitesStack.stackName, "GenesisStagingS2gDbAdminDiagnosticPrerequisitesStack");
  assert.equal(pack.prerequisitesStack.type, "CREATE");
  assert.equal(pack.prerequisitesStack.resources.length, 6);
  assert.equal(pack.prerequisitesStack.createOnlyChangeSet.prepareCommands.length, 2);
  assert.ok(pack.prerequisitesStack.createOnlyChangeSet.prohibitedActions.some((line) => line.includes("Modify/Delete/Replace")));
  assert.equal(pack.phases.length, 7);
  assert.deepEqual(pack.phases.map((phase) => phase.id), ["A", "B", "B1", "C", "D", "E", "F"]);
  const phaseF = pack.phases.find((phase) => phase.id === "F");
  assert.ok(phaseF.expectedOutputs.some((line) => line.includes("LauncherActivationState remains DISABLED")));
});

test("diagnostic dockerfile enforces pinned base digest and dedicated entrypoint", async () => {
  const dockerfile = await readText("infra/staging/Dockerfile.s2g-db-admin-diagnostic");
  assert.match(dockerfile, /NODE_RUNTIME_BASE must be pinned to an immutable digest/);
  assert.match(dockerfile, /ENTRYPOINT \["node", "scripts\/staging-s2g-db-admin-diagnostic\.mjs"\]/);
  assert.doesNotMatch(dockerfile, /aws cli|awscli/i);
});
