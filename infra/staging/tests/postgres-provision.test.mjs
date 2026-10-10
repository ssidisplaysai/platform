import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readRepoFile(path) {
  return readFile(resolve(repoRoot, path), "utf8");
}

function parseJson(text) {
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function actionsOf(policy) {
  return policy.Statement.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action],
  );
}

function findStatement(policy, sid) {
  const statement = policy.Statement.find((candidate) => candidate.Sid === sid);
  assert.ok(statement, `Missing policy statement ${sid}`);
  return statement;
}

test("staging PostgreSQL IAM grants are exact, tagged, and do not expose secret values", async () => {
  const source = await readRepoFile("infra/staging/iam/05-staging-postgres-provisioning.json");
  const policy = parseJson(source);
  const actions = actionsOf(policy);
  const expectedActions = [
    "ec2:DescribeRouteTables",
    "ec2:DescribeSecurityGroups",
    "ec2:DescribeSubnets",
    "iam:CreateServiceLinkedRole",
    "rds:AddTagsToResource",
    "rds:CreateDBInstance",
    "rds:CreateDBSubnetGroup",
    "rds:DescribeDBInstances",
    "rds:DescribeDBSubnetGroups",
    "rds:ListTagsForResource",
    "secretsmanager:CreateSecret",
    "secretsmanager:DescribeSecret",
    "secretsmanager:TagResource",
  ];
  const statements = [
    "PostgresNetworkDescribe",
    "RdsPostgresDescribe",
    "RdsCreateStagingPostgres",
    "RdsUseStagingPostgresSubnetGroup",
    "RdsUseDefaultPostgres16Groups",
    "RdsCreateStagingPostgresSubnetGroup",
    "RdsTagStagingPostgresOnCreate",
    "RdsListStagingPostgresTags",
    "CreateStagingPostgresSecret",
    "TagStagingPostgresSecret",
    "DescribeStagingPostgresSecret",
    "CreateRdsServiceLinkedRole",
  ];
  const targetDb = "arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres";
  const targetSubnetGroup = "arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres";
  const targetSecret = "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*";

  assert.ok(Buffer.byteLength(source.replace(/\s/g, "")) < 6144);
  assert.deepEqual([...new Set(actions)].sort(), expectedActions.sort());
  assert.ok(statements.every((sid) => policy.Statement.some((statement) => statement.Sid === sid)));
  assert.ok(actions.every((action) => !action.includes("*")));
  assert.ok(!actions.includes("secretsmanager:GetSecretValue"));
  assert.ok(!actions.includes("iam:PassRole"));
  assert.ok(!actions.includes("rds:ModifyDBInstance"));
  assert.ok(!actions.includes("rds:DeleteDBInstance"));
  assert.ok(!actions.includes("rds:DeleteDBSubnetGroup"));

  assert.deepEqual(findStatement(policy, "RdsPostgresDescribe").Resource, "*");
  assert.deepEqual(findStatement(policy, "RdsCreateStagingPostgres").Resource, targetDb);
  assert.deepEqual(findStatement(policy, "RdsUseStagingPostgresSubnetGroup").Resource, targetSubnetGroup);
  assert.deepEqual(findStatement(policy, "RdsUseDefaultPostgres16Groups").Resource, [
    "arn:aws:rds:us-west-2:452630323448:pg:default.postgres16",
    "arn:aws:rds:us-west-2:452630323448:og:default:postgres-16",
  ]);
  assert.deepEqual(findStatement(policy, "RdsCreateStagingPostgresSubnetGroup").Resource, targetSubnetGroup);
  assert.deepEqual(findStatement(policy, "CreateStagingPostgresSecret").Resource, targetSecret);
  assert.deepEqual(findStatement(policy, "DescribeStagingPostgresSecret").Resource, targetSecret);
  assert.deepEqual(findStatement(policy, "CreateRdsServiceLinkedRole").Resource,
    "arn:aws:iam::452630323448:role/aws-service-role/rds.amazonaws.com/AWSServiceRoleForRDS");
  assert.deepEqual(findStatement(policy, "CreateRdsServiceLinkedRole").Condition, {
    StringEquals: { "iam:AWSServiceName": "rds.amazonaws.com" },
  });

  for (const sid of [
    "RdsCreateStagingPostgres",
    "RdsCreateStagingPostgresSubnetGroup",
    "RdsTagStagingPostgresOnCreate",
    "CreateStagingPostgresSecret",
    "TagStagingPostgresSecret",
  ]) {
    assert.equal(
      findStatement(policy, sid).Condition.StringEquals["aws:RequestTag/Environment"],
      "staging",
    );
  }
  assert.deepEqual(findStatement(policy, "RdsCreateStagingPostgres").Condition.StringEquals, {
    "rds:DatabaseClass": "db.t4g.micro",
    "rds:DatabaseEngine": "postgres",
    "aws:RequestTag/Environment": "staging",
  });
  const createDbStatements = policy.Statement
    .filter((statement) => (Array.isArray(statement.Action) ? statement.Action : [statement.Action])
      .includes("rds:CreateDBInstance"));
  assert.deepEqual(createDbStatements
    .flatMap((statement) => Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource])
    .sort(), [
    targetDb,
    targetSubnetGroup,
    "arn:aws:rds:us-west-2:452630323448:pg:default.postgres16",
    "arn:aws:rds:us-west-2:452630323448:og:default:postgres-16",
  ].sort());

  const rdsActions = actions.filter((action) => action.startsWith("rds:"));
  assert.ok(rdsActions.every((action) =>
    ["rds:AddTagsToResource", "rds:CreateDBInstance", "rds:CreateDBSubnetGroup",
      "rds:DescribeDBInstances", "rds:DescribeDBSubnetGroups", "rds:ListTagsForResource"]
      .includes(action),
  ));
  const secretsActions = actions.filter((action) => action.startsWith("secretsmanager:"));
  assert.deepEqual(secretsActions.sort(), [
    "secretsmanager:CreateSecret",
    "secretsmanager:DescribeSecret",
    "secretsmanager:TagResource",
  ]);
});

test("PostgreSQL policy simulation covers scoped staging allows and production denials", async () => {
  const cases = parseJson(await readRepoFile("infra/staging/iam/simulation-cases.json"));
  const expected = [
    ["rds:DescribeDBInstances", "allow", "db:genesis-staging-postgres"],
    ["rds:DescribeDBInstances", "allow", "db:genesis-production-postgres"],
    ["rds:DescribeDBSubnetGroups", "allow", "subgrp:genesis-staging-postgres"],
    ["rds:DescribeDBSubnetGroups", "allow", "subgrp:genesis-production-postgres"],
    ["rds:CreateDBInstance", "allow", "db:genesis-staging-postgres"],
    ["rds:CreateDBSubnetGroup", "allow", "subgrp:genesis-staging-postgres"],
    ["rds:AddTagsToResource", "allow", "db:genesis-staging-postgres"],
    ["rds:ListTagsForResource", "allow", "db:genesis-staging-postgres"],
    ["secretsmanager:CreateSecret", "allow", "secret:genesis/staging/postgres-"],
    ["secretsmanager:TagResource", "allow", "secret:genesis/staging/postgres-"],
    ["secretsmanager:DescribeSecret", "allow", "secret:genesis/staging/postgres-"],
  ];
  for (const [action, expect, resourceFragment] of expected) {
    assert.ok(cases.some((simulationCase) =>
      simulationCase.action === action &&
      simulationCase.expect === expect &&
      simulationCase.resource.includes(resourceFragment),
    ), `Missing ${expect} simulation for ${action} ${resourceFragment}`);
  }
  assert.ok(cases.some((item) =>
    item.action === "rds:CreateDBInstance" &&
    item.expect === "deny" &&
    item.context["rds:DatabaseClass"] === "db.t4g.small",
  ));
  assert.ok(cases.some((item) =>
    item.action === "rds:CreateDBInstance" &&
    item.expect === "deny" &&
    item.context["rds:DatabaseEngine"] === "mysql",
  ));
  assert.equal(cases.length, 95);
  const createDbCase = (resource, expect, environment, extraContext = {}) => cases.find((item) =>
    item.action === "rds:CreateDBInstance" &&
    item.resource === resource &&
    item.expect === expect &&
    item.context["aws:RequestTag/Environment"] === environment &&
    Object.entries(extraContext).every(([key, value]) => item.context[key] === value)
  );
  const stagingDb = "arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres";
  const productionDb = "arn:aws:rds:us-west-2:452630323448:db:genesis-production-postgres";
  const approvedCreate = createDbCase(stagingDb, "allow", "staging", {
    "rds:DatabaseClass": "db.t4g.micro",
    "rds:DatabaseEngine": "postgres",
  });
  assert.ok(approvedCreate, "approved staging DB create must be allowed");
  assert.equal(Object.hasOwn(approvedCreate.context, "rds:DatabaseName"), false);
  assert.ok(createDbCase(productionDb, "deny", "production"), "production DB create must be denied");
  assert.ok(createDbCase(stagingDb, "deny", "production"), "wrong Environment tag must be denied");
  assert.ok(cases.some((item) =>
    item.action === "rds:CreateDBInstance" &&
    item.resource === stagingDb &&
    item.expect === "deny" &&
    item.context["rds:DatabaseClass"] === "db.t4g.small",
  ), "wrong DB class must be denied");
  assert.ok(cases.some((item) =>
    item.action === "rds:CreateDBInstance" &&
    item.resource === stagingDb &&
    item.expect === "deny" &&
    item.context["rds:DatabaseEngine"] === "mysql",
  ), "wrong DB engine must be denied");
  for (const action of ["ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress"]) {
    assert.ok(cases.some((item) =>
      item.action === action &&
      item.expect === "allow" &&
      item.context["aws:RequestTag/Environment"] === "staging" ||
      item.action === action &&
      item.expect === "allow" &&
      item.context["aws:ResourceTag/Environment"] === "staging",
    ), `Missing staging DB security-group allow simulation for ${action}`);
  }
  assert.ok(cases.some((item) =>
    item.action === "ec2:AuthorizeSecurityGroupIngress" &&
    item.expect === "allow" &&
    item.scenario === "staging-postgres-ingress" &&
    item.request?.protocol === "tcp" &&
    item.request?.fromPort === 5432 &&
    item.request?.toPort === 5432 &&
    item.request?.source === "staging-task-security-group",
  ));
  assert.ok(cases.some((item) =>
    item.action === "ec2:RevokeSecurityGroupEgress" &&
    item.expect === "allow" &&
    item.scenario === "staging-postgres-remove-default-egress" &&
    item.context["aws:ResourceTag/Environment"] === "staging",
  ));
  const productionDenyCases = [
    ["rds:ModifyDBInstance", "db:genesis-production-postgres"],
    ["rds:DeleteDBInstance", "db:genesis-production-postgres"],
    ["ec2:RevokeSecurityGroupEgress", "security-group/sg-08117e5cf7cef2d09"],
    ["secretsmanager:GetSecretValue", "secret:genesis/production/"],
    ["ecs:RegisterTaskDefinition", "task-definition/genesis-production-web"],
    ["ecs:RunTask", "task-definition/genesis-production-web"],
    ["cloudformation:CreateStack", "stack/GenesisRuntimeStack"],
    ["cloudformation:UpdateStack", "stack/GenesisRuntimeStack"],
    ["cloudformation:ExecuteChangeSet", "stack/GenesisRuntimeStack"],
  ];
  for (const [action, fragment] of productionDenyCases) {
    assert.ok(cases.some((item) =>
      item.action === action &&
      item.expect === "deny" &&
      item.resource.includes(fragment) &&
      item.requireExplicitDeny === true,
    ), `Missing explicit production deny for ${action} ${fragment}`);
  }
});

test("policy 03 retains staging data scope without PostgreSQL provisioning grants", async () => {
  const source = await readRepoFile("infra/staging/iam/03-staging-data-iam.json");
  const policy = parseJson(source);
  const actions = actionsOf(policy);
  const postgresActions = actions.filter((action) =>
    action.startsWith("rds:") || action.startsWith("secretsmanager:"),
  );
  assert.deepEqual(postgresActions, []);
  assert.ok(Buffer.byteLength(source.replace(/\s/g, "")) < 6144);
});

test("all five scoped managed policies remain below the IAM size ceiling", async () => {
  for (const policyNumber of ["01", "02", "03", "04", "05"]) {
    const file = `infra/staging/iam/${policyNumber}-${{
      "01": "read-only-production-inspection",
      "02": "staging-compute-network-auth",
      "03": "staging-data-iam",
      "04": "production-guardrails-deny",
      "05": "staging-postgres-provisioning",
    }[policyNumber]}.json`;
    const source = await readRepoFile(file);
    assert.ok(
      Buffer.byteLength(source.replace(/\s/g, "")) < 6144,
      `${file} exceeds the AWS managed-policy size ceiling`,
    );
    const policy = parseJson(source);
    assert.ok(actionsOf(policy).every((action) => !action.includes("*")), `${file} has a wildcard action`);
  }
});

test("database-only provisioning is isolated and gated from the broad staging provisioner", async () => {
  const script = await readRepoFile("infra/staging/postgres-provision.sh");
  const secretHelper = await readRepoFile("infra/staging/create-postgres-app-secret.sh");
  const workflow = await readRepoFile(".github/workflows/genesis-staging-infra.yml");
  const admin = await readRepoFile("infra/staging/admin-bootstrap-iam.sh");

  assert.match(script, /node "\$SCRIPT_DIR\/plan-gate\.mjs"/);
  assert.match(script, /CONFIRM:-.*APPLY-STAGING-POSTGRES/);
  assert.match(script, /Refusing non-read-only AWS operation in postgres plan mode/);
  assert.match(script, /genesis-staging-postgres/);
  assert.match(script, /--engine-version 16\.13/);
  assert.match(script, /readonly DATABASE_NAME="genesis_staging"/);
  assert.match(script, /--db-name "\$DATABASE_NAME"/);
  assert.match(script, /if \[ -z "\$app_secret_json" \]; then/);
  assert.match(script, /create-postgres-app-secret\.sh/);
  assert.match(script, /app_secret_json="\$\(aws_call secretsmanager describe-secret --secret-id "\$APP_SECRET_NAME" --output json\)"/);
  assert.doesNotMatch(script, /--generate-secret-string/);
  assert.match(secretHelper, /node "\$SCRIPT_DIR\/create-postgres-app-secret-payload\.mjs"/);
  assert.match(secretHelper, /--secret-string "\$\(aws_cli_file_uri "\$secret_payload_file"\)"/);
  assert.match(secretHelper, /--tags Key=Environment,Value=staging/);
  assert.match(secretHelper, /trap cleanup_secret_payload EXIT/);
  assert.match(secretHelper, /rm -f -- "\$secret_payload_file"/);
  assert.match(secretHelper, /secretsmanager create-secret/);
  assert.doesNotMatch(secretHelper, /put-secret-value|get-secret-value|GetRandomPassword/i);
  assert.match(secretHelper, /outside the repository/);
  const secretPayload = await readRepoFile("infra/staging/create-postgres-app-secret-payload.mjs");
  assert.match(secretPayload, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(secretPayload, /open\(filePath, "wx", 0o600\)/);
  assert.match(script, /--db-instance-class db\.t4g\.micro/);
  assert.match(script, /--allocated-storage 20/);
  assert.match(script, /--storage-type gp3/);
  assert.match(script, /--manage-master-user-password/);
  assert.match(script, /--backup-retention-period 7/);
  assert.match(script, /--deletion-protection/);
  assert.match(script, /--no-multi-az/);
  assert.match(script, /--no-publicly-accessible/);
  assert.match(script, /revoke-security-group-egress/);
  assert.match(script, /IpPermissionsEgress \| length == 0/);
  assert.doesNotMatch(script, /secretsmanager get-secret-value|iam put-role-policy|iam attach-role-policy/i);
  assert.doesNotMatch(script, /--db-instance-identifier[^ \n]*genesis-production-postgres|rds:ModifyDBInstance|rds:DeleteDBInstance/i);

  assert.match(workflow, /postgres-plan, postgres-apply/);
  assert.match(workflow, /plan\|apply\|postgres-plan\|postgres-apply/);
  assert.match(workflow, /APPLY-STAGING-POSTGRES/);
  assert.match(workflow, /postgres-provision\.sh apply/);
  assert.match(workflow, /provision\.sh "\$\{\{ inputs\.mode \}\}"/);
  assert.match(admin, /--refresh-staging-data-policy/);
});
