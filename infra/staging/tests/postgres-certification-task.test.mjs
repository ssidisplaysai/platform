import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validatePostgresCertificationExecutionPolicy } from "../iam/validate-postgres-certification-execution-policy.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(relativePath) {
  return JSON.parse((await readFile(resolve(repoRoot, relativePath), "utf8")).replace(/^\uFEFF/, ""));
}

test("certification task is a private one-off with read-only EFS and no production/runtime bindings", async () => {
  const task = await readJson("infra/staging/postgres-certification-task-definition.template.json");
  assert.equal(task.family, "genesis-staging-postgres-certification");
  assert.deepEqual(task.requiresCompatibilities, ["FARGATE"]);
  assert.equal(task.networkMode, "awsvpc");
  assert.equal(task.cpu, "1024");
  assert.equal(task.memory, "2048");
  assert.equal(task.taskRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-task-role");
  assert.equal(task.executionRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-execution-role");
  const [container] = task.containerDefinitions;
  assert.equal(task.containerDefinitions.length, 1);
  assert.equal(container.name, "PostgresCertification");
  assert.equal(container.user, "1000:1000");
  assert.equal(container.readonlyRootFilesystem, true);
  assert.equal(container.portMappings, undefined);
  assert.equal(container.secrets.length, 4);
  assert.ok(container.secrets.every(({ valueFrom }) => valueFrom.includes(":username::") || valueFrom.includes(":password::")));
  assert.deepEqual(container.secrets.map(({ name }) => name).sort(), [
    "DB_ADMIN_PASSWORD",
    "DB_ADMIN_USERNAME",
    "DB_PASSWORD",
    "DB_USERNAME",
  ]);
  assert.ok(container.environment.some(({ name, value }) =>
    name === "GENESIS_ENVIRONMENT" && value === "staging"));
  assert.ok(container.environment.some(({ name, value }) =>
    name === "GENESIS_RDS_CA_CERT" && value === "/app/certs/rds-global-bundle.pem"));
  assert.deepEqual(container.environment.map(({ name }) => name).sort(), [
    "DB_HOST",
    "DB_NAME",
    "DB_PORT",
    "GENESIS_ENVIRONMENT",
    "GENESIS_RDS_CA_CERT",
    "POSTGRES_CERTIFICATION_SOURCE",
  ]);
  assert.ok(!container.environment.some(({ name }) => name === "GENESIS_STATE_BACKEND"));
  assert.ok(!container.environment.some(({ name }) => /PRODUCTION|WOO|OPENAI|WORDPRESS/i.test(name)));
  assert.ok(!container.secrets.some(({ valueFrom }) => /production|wordpress|openai/i.test(valueFrom)));
  assert.deepEqual(container.mountPoints, [{
    sourceVolume: "genesis-persistence",
    containerPath: "/mnt/genesis-persistence",
    readOnly: true,
  }]);
  assert.equal(task.volumes[0].efsVolumeConfiguration.authorizationConfig.iam, "DISABLED");
  assert.equal(container.logConfiguration.options["awslogs-group"], "/genesis/staging/web");
  assert.equal(container.logConfiguration.options["awslogs-stream-prefix"], "postgres-certification");
});

test("certification path keeps TLS verification enabled and has no TLS bypass", async () => {
  const paths = [
    "scripts/postgres-connection.mjs",
    "scripts/postgres-ca-preflight.mjs",
    "scripts/staging-postgres-certification.mjs",
    "Dockerfile.postgres-certification",
    "infra/staging/postgres-certification-task-definition.template.json",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(resolve(repoRoot, path), "utf8")));
  const source = sources.join("\n");
  assert.match(source, /rejectUnauthorized:\s*true/);
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
  assert.doesNotMatch(source, /NODE_TLS_REJECT_UNAUTHORIZED\s*=/);
});

test("certification image is isolated from the live runtime Dockerfile", async () => {
  const [runtime, certification, bundle] = await Promise.all([
    readFile(resolve(repoRoot, "Dockerfile"), "utf8"),
    readFile(resolve(repoRoot, "Dockerfile.postgres-certification"), "utf8"),
    readFile(resolve(repoRoot, "infra/staging/certificates/aws-rds-global-bundle.pem")),
  ]);
  assert.match(runtime, /CMD \["node_modules\/next\/dist\/bin\/next", "start"/);
  assert.match(certification, /scripts\/staging-postgres-certification\.mjs/);
  assert.match(certification, /COPY infra\/staging\/certificates\/aws-rds-global-bundle\.pem \/app\/certs\/rds-global-bundle\.pem/);
  assert.match(certification, /30m/);
  assert.match(certification, /USER node/);
  assert.equal(
    createHash("sha256").update(bundle).digest("hex"),
    "fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c",
  );
});

test("permission plan identifies only missing task launch and scoped credential injection grants", async () => {
  const [plan, deployPolicy, inspectionPolicy, executionPolicy, certificationSecretPolicy, guardrails, task] = await Promise.all([
    readJson("infra/staging/postgres-certification-permissions.plan.json"),
    readJson("infra/staging/iam/02-staging-compute-network-auth.json"),
    readJson("infra/staging/iam/01-read-only-production-inspection.json"),
    readFile(resolve(repoRoot, "infra/staging/admin-bootstrap-iam.sh"), "utf8"),
    readJson("infra/staging/iam/postgres-certification-execution-secrets.json"),
    readJson("infra/staging/iam/04-production-guardrails-deny.json"),
    readJson("infra/staging/postgres-certification-task-definition.template.json"),
  ]);
  const newPermissions = plan.newPermissions;
  assert.equal(plan.status, "approved-not-applied");
  assert.deepEqual(newPermissions.map(({ action }) => action), [
    "ecs:RunTask",
    "secretsmanager:GetSecretValue",
  ]);
  assert.equal(plan.clusterArn, "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production");
  assert.equal(plan.executionRole, "arn:aws:iam::452630323448:role/genesis-staging-execution-role");
  assert.equal(plan.taskRole, "arn:aws:iam::452630323448:role/genesis-staging-task-role");
  assert.deepEqual(plan.subnets, ["subnet-0f303dea5f645e42d", "subnet-00a0b287895a3b18c"]);
  assert.equal(plan.securityGroup, "sg-0687242229bc3a80e");
  assert.equal(plan.assignPublicIp, "DISABLED");
  assert.equal(plan.fargatePlatformVersion, "1.4.0");
  assert.equal(plan.efsFileSystem, "fs-0f71cea9a21267d64");
  assert.equal(plan.efsAccessPoint, "fsap-0063c7342f4496332");
  assert.equal(plan.efsReadOnlyPath, "/mnt/genesis-persistence/foundation");
  assert.equal(plan.logGroup, "/genesis/staging/web");
  assert.equal(newPermissions.length, 2);
  assert.equal(newPermissions[0].action, "ecs:RunTask");
  assert.equal(
    newPermissions[0].resource,
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-postgres-certification:*",
  );
  assert.deepEqual(newPermissions[0].condition.ArnEquals, {
    "ecs:cluster": "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
  });
  assert.equal(newPermissions[1].action, "secretsmanager:GetSecretValue");
  assert.deepEqual(newPermissions[1].resource, [
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-JFaw1C",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
  ]);
  assert.ok(!JSON.stringify(newPermissions).includes('"Resource":"*"'));
  assert.ok(deployPolicy.Statement.some((statement) =>
    (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("ecs:RegisterTaskDefinition")));
  assert.ok(deployPolicy.Statement.some((statement) =>
    (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("iam:PassRole")
    && statement.Resource.includes("arn:aws:iam::452630323448:role/genesis-staging-execution-role")
    && statement.Resource.includes("arn:aws:iam::452630323448:role/genesis-staging-task-role")));
  assert.ok(inspectionPolicy.Statement.some((statement) =>
    (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("ecs:DescribeTasks")
    && statement.Condition.ArnEquals["ecs:cluster"] === plan.clusterArn));
  const runTask = deployPolicy.Statement.find(({ Sid }) => Sid === "EcsRunStagingPostgresCertificationTask");
  assert.deepEqual(runTask, {
    Sid: "EcsRunStagingPostgresCertificationTask",
    Effect: "Allow",
    Action: "ecs:RunTask",
    Resource: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-postgres-certification:*",
    Condition: {
      ArnEquals: {
        "ecs:cluster": "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
      },
    },
  });
  assert.equal(deployPolicy.Statement.filter((statement) =>
    (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("ecs:RunTask")).length, 1);

  validatePostgresCertificationExecutionPolicy(certificationSecretPolicy);
  const secretStatement = certificationSecretPolicy.Statement[0];
  const executionAllowsSecret = (resource) =>
    secretStatement.Action === "secretsmanager:GetSecretValue" && secretStatement.Resource.includes(resource);
  assert.equal(executionAllowsSecret(newPermissions[1].resource[0]), true);
  assert.equal(executionAllowsSecret(newPermissions[1].resource[1]), true);
  for (const resource of [
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-*",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/openai-AbCdEf",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/other-AbCdEf",
  ]) {
    assert.equal(executionAllowsSecret(resource), false, `${resource} must not be granted`);
  }
  assert.equal(
    deployPolicy.Statement.some((statement) =>
      (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("secretsmanager:GetSecretValue")),
    false,
  );
  assert.equal(
    certificationSecretPolicy.Statement.some((statement) =>
      (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes("secretsmanager:GetSecretValue")
      && statement.Resource.some((resource) => /genesis\/production|wordpress|openai/.test(resource))),
    false,
  );
  assert.equal(task.taskRoleArn, "arn:aws:iam::452630323448:role/genesis-staging-task-role");
  assert.ok(!JSON.stringify(certificationSecretPolicy).includes(task.taskRoleArn));
  assert.ok(!JSON.stringify(guardrails).includes("EcsRunStagingPostgresCertificationTask"));
  assert.ok(!JSON.stringify(guardrails).includes("postgres-certification-execution-secrets"));
  const newlyApprovedActions = newPermissions.map(({ action }) => action);
  for (const action of [
    "ecs:CreateService",
    "ecs:UpdateService",
    "ecs:DeleteService",
    "ecs:ExecuteCommand",
    "ecs:StopTask",
    "kms:Decrypt",
  ]) {
    assert.ok(!newlyApprovedActions.includes(action), `${action} must not be added`);
  }
  assert.ok(!certificationSecretPolicy.Statement.flatMap(({ Action }) => Array.isArray(Action) ? Action : [Action])
    .some((action) => /^ecs:|^kms:/.test(action)));
  assert.equal(plan.newPermissions[0].principal, "arn:aws:iam::452630323448:role/GenesisGitHubDeployRole");
  assert.equal(plan.newPermissions[0].action, "ecs:RunTask");
  assert.equal(plan.newPermissions[1].principal, plan.executionRole);
  assert.equal(plan.newPermissions[1].policyFile, "infra/staging/iam/postgres-certification-execution-secrets.json");
  assert.equal(plan.newPermissions[1].inlinePolicyName, "staging-postgres-certification-secret-read");
  const cases = await readJson("infra/staging/iam/simulation-cases.json");
  const hasCase = (action, resource, expect, policySet) => cases.some((item) =>
    item.action === action
    && item.resource === resource
    && item.expect === expect
    && item.policySet === policySet);
  assert.ok(hasCase(
    "ecs:RunTask",
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-postgres-certification:1",
    "allow",
    undefined,
  ));
  assert.ok(hasCase(
    "ecs:RunTask",
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-postgres-certification:1",
    "deny",
    undefined,
  ));
  assert.ok(hasCase(
    "ecs:RunTask",
    "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:1",
    "deny",
    undefined,
  ));
  for (const resource of [
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-*",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/openai-secret",
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/other-secret-AbCdEf",
  ]) {
    assert.ok(hasCase("secretsmanager:GetSecretValue", resource, "deny", "postgres-certification-execution"));
  }
  assert.match(executionPolicy, /--refresh-staging-postgres-certification-permissions/);
  assert.deepEqual(plan.notRequired, [
    "ecs:CreateService",
    "ecs:UpdateService",
    "ecs:StopTask",
    "ecs:ExecuteCommand",
    "iam:CreateRole",
    "iam:PutRolePolicy",
    "elasticfilesystem:*",
    "kms:Decrypt",
  ]);
});
