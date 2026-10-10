import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const policyUrl = new URL("../iam/01-read-only-production-inspection.json", import.meta.url);
const adminHelperUrl = new URL("../admin-bootstrap-iam.sh", import.meta.url);
const policy = JSON.parse(await readFile(fileURLToPath(policyUrl), "utf8"));
const adminHelper = await readFile(fileURLToPath(adminHelperUrl), "utf8");
const statements = policy.Statement;
const allActions = statements.flatMap((statement) =>
  Array.isArray(statement.Action) ? statement.Action : [statement.Action]);
const addedStatements = statements.filter((statement) =>
  statement.Sid.startsWith("Production") && statement.Sid !== "ProductionImageProvenanceReadOnly");
const approvedActions = [
  "cloudformation:DescribeStacks",
  "cloudwatch:DescribeAlarms",
  "ec2:DescribeRouteTables",
  "ecr:BatchGetImage",
  "ecr:ListImages",
  "ecs:DescribeTasks",
  "ecs:ListTaskDefinitions",
  "ecs:ListTasks",
  "logs:DescribeLogStreams",
  "rds:DescribeDBClusterSnapshots",
  "rds:DescribeDBClusters",
  "rds:DescribeDBInstances",
  "rds:DescribeDBSnapshots",
  "rds:DescribeDBSubnetGroups",
];

function resourcesFor(action) {
  return statements
    .filter((statement) => {
      const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
      return actions.includes(action);
    })
    .flatMap((statement) => Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource]);
}

test("inspection policy contains exactly the approved new actions and no mutation permissions", () => {
  const originalActions = [
    "ecs:DescribeServices",
    "ecs:DescribeTaskDefinition",
    "cloudtrail:LookupEvents",
    "elasticloadbalancing:DescribeTargetGroups",
    "elasticloadbalancing:DescribeLoadBalancers",
    "elasticloadbalancing:DescribeListeners",
    "elasticloadbalancing:DescribeRules",
    "elasticloadbalancing:DescribeListenerCertificates",
    "elasticloadbalancing:DescribeTargetHealth",
    "ec2:DescribeSecurityGroups",
    "ec2:DescribeSubnets",
    "ec2:DescribeNetworkInterfaces",
    "sts:GetCallerIdentity",
    "cognito-idp:DescribeUserPool",
    "cognito-idp:DescribeUserPoolClient",
    "cognito-idp:ListUserPoolClients",
    "iam:GetPolicy",
    "iam:GetPolicyVersion",
    "iam:GetRole",
    "iam:ListAttachedRolePolicies",
    "iam:ListRolePolicies",
    "iam:GetRolePolicy",
    "iam:SimulatePrincipalPolicy",
    "iam:SimulateCustomPolicy",
    "ecr:DescribeImages",
    "ecr:DescribeRepositories",
  ];
  assert.deepEqual([...new Set(allActions)].sort(), [...originalActions, ...approvedActions].sort());
  assert.equal(allActions.some((action) => action.includes("*")), false);
  assert.deepEqual(addedStatements.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action])
    .sort(), [...approvedActions].sort());
  for (const action of [
    "secretsmanager:GetSecretValue",
    "iam:PassRole",
    "ecs:UpdateService",
    "ecs:RegisterTaskDefinition",
    "ecs:DeregisterTaskDefinition",
    "ecr:PutImage",
    "cloudformation:CreateStack",
    "cloudformation:UpdateStack",
    "cloudformation:ExecuteChangeSet",
    "rds:CreateDBInstance",
    "rds:CreateDBCluster",
    "rds:DeleteDBInstance",
    "rds:DeleteDBCluster",
    "rds:ModifyDBInstance",
    "rds:ModifyDBCluster",
    "ec2:AuthorizeSecurityGroupIngress",
    "ec2:AuthorizeSecurityGroupEgress",
    "ec2:RevokeSecurityGroupIngress",
    "ec2:RevokeSecurityGroupEgress",
    "logs:PutLogEvents",
    "cloudwatch:PutMetricAlarm",
    "cloudwatch:DeleteAlarms",
  ]) {
    assert.equal(allActions.includes(action), false, `${action} must not be granted`);
  }
});

test("inspection policy scopes each supported action to production resources", () => {
  const expected = {
    "cloudformation:DescribeStacks": [
      "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*",
    ],
    "ecr:BatchGetImage": [
      "arn:aws:ecr:us-west-2:452630323448:repository/genesis-production-runtime",
    ],
    "ecr:ListImages": [
      "arn:aws:ecr:us-west-2:452630323448:repository/genesis-production-runtime",
    ],
    "ecs:DescribeTasks": [
      "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
      "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/*",
    ],
    "ecs:ListTasks": [
      "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    ],
    "logs:DescribeLogStreams": [
      "arn:aws:logs:us-west-2:452630323448:log-group:/genesis/production/web:*",
    ],
    "rds:DescribeDBClusterSnapshots": ["*"],
    "rds:DescribeDBClusters": ["*"],
    "rds:DescribeDBInstances": ["*"],
    "rds:DescribeDBSnapshots": ["*"],
    "rds:DescribeDBSubnetGroups": ["*"],
  };
  for (const [action, resources] of Object.entries(expected)) {
    assert.deepEqual(resourcesFor(action).sort(), resources.sort(), action);
  }
});

test("only unscopable inventory actions use Resource star", () => {
  const starActions = addedStatements
    .filter((statement) => statement.Resource === "*")
    .flatMap((statement) => Array.isArray(statement.Action) ? statement.Action : [statement.Action])
    .sort();
  assert.deepEqual(starActions, [
    "cloudwatch:DescribeAlarms",
    "ec2:DescribeRouteTables",
    "ecs:ListTaskDefinitions",
    "rds:DescribeDBClusterSnapshots",
    "rds:DescribeDBClusters",
    "rds:DescribeDBInstances",
    "rds:DescribeDBSnapshots",
    "rds:DescribeDBSubnetGroups",
  ].sort());
  assert.deepEqual(resourcesFor("cloudwatch:DescribeAlarms"), ["*"]);
  assert.deepEqual(resourcesFor("ec2:DescribeRouteTables"), ["*"]);
  assert.deepEqual(resourcesFor("ecs:ListTaskDefinitions"), ["*"]);
  for (const action of [
    "rds:DescribeDBClusterSnapshots",
    "rds:DescribeDBClusters",
    "rds:DescribeDBInstances",
    "rds:DescribeDBSnapshots",
    "rds:DescribeDBSubnetGroups",
  ]) {
    assert.deepEqual(resourcesFor(action), ["*"], `${action} requires Resource star`);
  }
});

test("administrator refresh mode changes only the existing inspection policy version", () => {
  const start = adminHelper.indexOf("refresh_production_inspection_policy() {");
  const end = adminHelper.indexOf('if [[ "${1:-}" == "--refresh-production-inspection-policy" ]]');
  assert.ok(start >= 0 && end > start);
  const refreshMode = adminHelper.slice(start, end);
  assert.match(refreshMode, /policy_arn "01-read-only-production-inspection"/);
  assert.match(refreshMode, /aws iam create-policy-version/);
  assert.match(refreshMode, /--set-as-default/);
  assert.match(refreshMode, /version_count.*-lt 5/s);
  assert.match(refreshMode, /INSPECTION_POLICY_READ_ONLY=PASS/);
  assert.doesNotMatch(refreshMode, /aws iam (?:attach-role-policy|detach-role-policy|put-role-policy|delete-policy)(?:\s|\\)/);
  assert.match(refreshMode, /"secretsmanager:GetSecretValue"/);
  assert.match(refreshMode, /"iam:PassRole"/);
  assert.match(refreshMode, /"ecs:UpdateService"/);
  assert.match(refreshMode, /"ecr:PutImage"/);
});
