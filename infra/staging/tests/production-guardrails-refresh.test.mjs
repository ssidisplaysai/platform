import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  EXPECTED_ACCOUNT,
  GUARDRAIL_POLICY_ARN,
  ROLE_NAME,
  refreshProductionGuardrailsPolicy,
} from "../iam/refresh-production-guardrails-policy.mjs";
import {
  EXPECTED_POLICY_DIGEST,
  EXPECTED_PREVIOUS_POLICY_DIGEST,
  isApprovedPreviousProductionGuardrailsPolicy,
  productionGuardrailsPolicyDigest,
  readAndValidateProductionGuardrailsPolicy,
  validateProductionGuardrailsPolicy,
} from "../iam/validate-production-guardrails-policy.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const policyFile = resolve(repoRoot, "infra/staging/iam/04-production-guardrails-deny.json");
const policyFileUri = "file://C:\\Users\\admin\\Genesis V2\\platform\\infra\\staging\\iam\\04-production-guardrails-deny.json";

async function repositoryPolicy() {
  return JSON.parse(await readFile(policyFile, "utf8"));
}

async function approvedPreviousPolicy() {
  const policy = await repositoryPolicy();
  const ecs = policy.Statement.find((statement) => statement.Sid === "DenyProductionEcsMutation");
  ecs.Action = ecs.Action.filter((action) =>
    action !== "ecs:RegisterTaskDefinition" && action !== "ecs:DeregisterTaskDefinition",
  );
  ecs.Resource = ecs.Resource[0];

  const global = policy.Statement.find((statement) => statement.Sid === "DenyGlobalInfrastructureMutation");
  const loadBalancerActions = global.Action.filter((action) => action.startsWith("elasticloadbalancing:"));
  const cognitoActions = global.Action.filter((action) => action.startsWith("cognito-idp:"));
  const statements = policy.Statement.filter((statement) =>
    statement.Sid !== "DenyGlobalInfrastructureMutation" &&
    statement.Sid !== "DenyProductionRdsMutation" &&
    statement.Sid !== "DenyProductionCloudFormationMutation",
  );
  statements.push(
    {
      Sid: "DenyListenerAndLoadBalancerMutation",
      Effect: "Deny",
      Action: loadBalancerActions,
      Resource: "*",
    },
    {
      Sid: "DenyCognitoClientAndPoolMutation",
      Effect: "Deny",
      Action: cognitoActions,
      Resource: "*",
    },
  );
  const statementOrder = [
    "DenyProductionEcsMutation",
    "DenyProductionEcr",
    "DenyProductionSecrets",
    "DenyListenerAndLoadBalancerMutation",
    "DenyNonStagingTargetGroupMutation",
    "DenyCognitoClientAndPoolMutation",
    "DenyProductionSecurityGroupMutation",
    "DenyProductionAndSelfRoleMutation",
    "DenyPassingProductionRoles",
    "DenyAnyPolicyOnStagingTaskRole",
  ];
  policy.Statement = statementOrder.map((sid) => statements.find((statement) => statement.Sid === sid));
  return policy;
}

function mockAws({ policy = null, attached = true, inline = [], account = EXPECTED_ACCOUNT, versionCount = 1 } = {}) {
  let activePolicy = policy;
  let defaultVersionId = "v2";
  const calls = [];
  const aws = async (args) => {
    calls.push([...args]);
    const operation = `${args[0]}:${args[1]}`;
    switch (operation) {
      case "sts:get-caller-identity":
        return { Account: account };
      case "iam:get-role":
        return { Role: { RoleName: ROLE_NAME } };
      case "iam:list-role-policies":
        return { PolicyNames: inline };
      case "iam:list-attached-role-policies":
        return {
          AttachedPolicies: attached ? [{ PolicyArn: GUARDRAIL_POLICY_ARN }] : [],
        };
      case "iam:get-policy":
        if (!activePolicy) throw new Error("NoSuchEntity: policy not found");
        return { Policy: { DefaultVersionId: defaultVersionId } };
      case "iam:get-policy-version":
        return activePolicy;
      case "iam:list-policy-versions":
        return { Versions: Array.from({ length: versionCount }, (_, index) => ({ VersionId: `v${index + 1}` })) };
      case "iam:create-policy-version":
        assert.equal(args[args.indexOf("--policy-arn") + 1], GUARDRAIL_POLICY_ARN);
        assert.equal(args[args.indexOf("--policy-document") + 1], policyFileUri);
        assert.ok(args.includes("--set-as-default"));
        activePolicy = { PolicyVersion: { Document: JSON.parse(await readFile(policyFile, "utf8")) } };
        defaultVersionId = `v${versionCount + 1}`;
        return { PolicyVersion: { VersionId: defaultVersionId } };
      default:
        throw new Error(`Unexpected mocked AWS API: ${operation}`);
    }
  };
  return { aws, calls };
}

async function runRefresh(options = {}) {
  const mock = mockAws(options);
  const reports = [];
  const result = await refreshProductionGuardrailsPolicy({
    aws: mock.aws,
    policyFile,
    policyFileUri,
    report: (line) => reports.push(line),
  });
  return { ...mock, reports, result };
}

test("repository policy 04 matches the reviewed deny-only baseline", async () => {
  const document = await readAndValidateProductionGuardrailsPolicy(policyFile);
  assert.equal(validateProductionGuardrailsPolicy(document), EXPECTED_POLICY_DIGEST);
  assert.ok(document.Statement.length > 0);
  assert.ok(document.Statement.every((statement) => statement.Effect === "Deny"));
});

test("approved previous AWS policy matches the exact reviewed pre-refresh document", async () => {
  const previous = await approvedPreviousPolicy();
  assert.equal(productionGuardrailsPolicyDigest(previous), EXPECTED_PREVIOUS_POLICY_DIGEST);
  assert.equal(isApprovedPreviousProductionGuardrailsPolicy(previous), true);
});

test("repository policy changes add protection without removing protection", async () => {
  const previous = await approvedPreviousPolicy();
  const current = await repositoryPolicy();
  const previousActions = new Set(previous.Statement.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action],
  ));
  const currentActions = new Set(current.Statement.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action],
  ));
  const added = [...currentActions].filter((action) => !previousActions.has(action)).sort();
  const removed = [...previousActions].filter((action) => !currentActions.has(action)).sort();
  assert.deepEqual(added, [
    "cloudformation:CreateChangeSet",
    "cloudformation:CreateStack",
    "cloudformation:DeleteChangeSet",
    "cloudformation:DeleteStack",
    "cloudformation:ExecuteChangeSet",
    "cloudformation:SetStackPolicy",
    "cloudformation:UpdateStack",
    "cloudformation:UpdateTerminationProtection",
    "ecs:DeregisterTaskDefinition",
    "ecs:RegisterTaskDefinition",
    "rds:DeleteDBCluster",
    "rds:DeleteDBInstance",
    "rds:ModifyDBCluster",
    "rds:ModifyDBInstance",
  ]);
  assert.deepEqual(removed, []);
  assert.equal(current.Statement.find((statement) => statement.Sid === "DenyProductionCloudFormationMutation").Resource,
    "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*");
  assert.equal(previous.Statement.find((statement) => statement.Sid === "DenyListenerAndLoadBalancerMutation").Resource,
    current.Statement.find((statement) => statement.Sid === "DenyGlobalInfrastructureMutation").Resource);
  assert.equal(previous.Statement.find((statement) => statement.Sid === "DenyCognitoClientAndPoolMutation").Resource,
    current.Statement.find((statement) => statement.Sid === "DenyGlobalInfrastructureMutation").Resource);
});

test("guardrail validator rejects unexpected Allow statements", async () => {
  const policy = await repositoryPolicy();
  policy.Statement.push({
    Sid: "UnexpectedAllow",
    Effect: "Allow",
    Action: "rds:ModifyDBInstance",
    Resource: "*",
  });
  assert.throws(() => validateProductionGuardrailsPolicy(policy), /only Deny statements/);
});

test("guardrail validator rejects a removed production deny", async () => {
  const policy = await repositoryPolicy();
  policy.Statement = policy.Statement.filter((statement) => statement.Sid !== "DenyProductionRdsMutation");
  assert.throws(() => validateProductionGuardrailsPolicy(policy), /missing, duplicating, or adding/);
});

test("guardrail validator rejects a weakened production resource scope", async () => {
  const policy = await repositoryPolicy();
  const rds = policy.Statement.find((statement) => statement.Sid === "DenyProductionRdsMutation");
  rds.Resource = ["arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres"];
  assert.throws(() => validateProductionGuardrailsPolicy(policy), /strictly reviewed production deny baseline/);
});

test("already-current policy 04 passes without creating a version", async () => {
  const currentPolicy = { PolicyVersion: { Document: await repositoryPolicy() } };
  const { calls, reports } = await runRefresh({ policy: currentPolicy });
  assert.ok(reports.some((line) => line.startsWith(`POLICY_ALREADY_CURRENT=${GUARDRAIL_POLICY_ARN}`)));
  assert.ok(reports.some((line) => line === "PRODUCTION_GUARDRAILS_POLICY=PASS VERSION=v2"));
  assert.equal(calls.filter((call) => call[1] === "create-policy-version").length, 0);
  assert.equal(calls.filter((call) => call[1] === "list-policy-versions").length, 0);
  assert.equal(calls.some((call) => call[1] === "attach-role-policy" || call[1] === "detach-role-policy"), false);
});

test("URL-encoded AWS policy documents are decoded before exact comparison", async () => {
  const currentPolicy = {
    PolicyVersion: { Document: encodeURIComponent(JSON.stringify(await repositoryPolicy())) },
  };
  const { reports } = await runRefresh({ policy: currentPolicy });
  assert.ok(reports.some((line) => line.startsWith(`POLICY_ALREADY_CURRENT=${GUARDRAIL_POLICY_ARN}`)));
  assert.ok(reports.some((line) => line.startsWith("PRODUCTION_GUARDRAILS_POLICY=PASS")));
});

test("a differing active policy gets a new verified default version", async () => {
  const oldPolicy = { PolicyVersion: { Document: await approvedPreviousPolicy() } };
  const { calls, reports } = await runRefresh({ policy: oldPolicy, versionCount: 2 });
  assert.ok(calls.some((call) => call[1] === "create-policy-version"));
  assert.ok(reports.some((line) => line === `POLICY_VERSION_CREATED=${GUARDRAIL_POLICY_ARN} VERSION=v3`));
  assert.ok(reports.some((line) => line === "PRODUCTION_GUARDRAILS_POLICY=PASS VERSION=v3"));
  assert.equal(calls.some((call) => call[1] === "attach-role-policy" || call[1] === "detach-role-policy"), false);
});

test("an unrecognized active policy fails closed before version creation", async () => {
  const unrecognized = {
    PolicyVersion: {
      Document: {
        Version: "2012-10-17",
        Statement: [{
          Sid: "UnknownDeny",
          Effect: "Deny",
          Action: ["ecs:UpdateService"],
          Resource: "*",
        }],
      },
    },
  };
  const { aws, calls } = mockAws({ policy: unrecognized });
  await assert.rejects(
    refreshProductionGuardrailsPolicy({ aws, policyFile, policyFileUri, report: () => {} }),
    /differs from both the exact reviewed pre-refresh baseline and repository target/,
  );
  assert.equal(calls.some((call) => call[1] === "list-policy-versions"), false);
  assert.equal(calls.some((call) => call[1] === "create-policy-version"), false);
});

test("refresh rejects a role without the existing guardrail attachment", async () => {
  await assert.rejects(
    runRefresh({ policy: { PolicyVersion: { Document: await repositoryPolicy() } }, attached: false }),
    /policy 04 is not attached/,
  );
});

test("refresh rejects missing policy 04", async () => {
  const mock = mockAws();
  const { aws } = mock;
  await assert.rejects(
    refreshProductionGuardrailsPolicy({
      aws,
      policyFile,
      policyFileUri,
      report: () => {},
    }),
    /NoSuchEntity/,
  );
});

test("refresh rejects inline policies and the wrong AWS account", async (t) => {
  await t.test("inline policy exists", async () => {
    await assert.rejects(
      runRefresh({ policy: { PolicyVersion: { Document: await repositoryPolicy() } }, inline: ["Unexpected"] }),
      /must have zero inline policies/,
    );
  });
  await t.test("wrong account", async () => {
    await assert.rejects(
      runRefresh({ account: "999999999999" }),
      /expected AWS account 452630323448/,
    );
  });
});

test("five-version limit stops without deleting policy history", async () => {
  const oldPolicy = { PolicyVersion: { Document: await approvedPreviousPolicy() } };
  const { aws, calls } = mockAws({ policy: oldPolicy, versionCount: 5 });
  const reports = [];
  await assert.rejects(
    refreshProductionGuardrailsPolicy({
      aws,
      policyFile,
      policyFileUri,
      report: (line) => reports.push(line),
    }),
    /GUARDRAIL_POLICY_VERSION_LIMIT_REACHED/,
  );
  assert.ok(reports.includes("GUARDRAIL_POLICY_VERSION_LIMIT_REACHED"));
  assert.equal(calls.filter((call) => call[1] === "delete-policy-version").length, 0);
  assert.equal(calls.filter((call) => call[1] === "create-policy-version").length, 0);
});

test("policy 04 strictly retains production mutation deny coverage", async () => {
  const policy = await repositoryPolicy();
  const actions = new Set(policy.Statement.flatMap((statement) =>
    Array.isArray(statement.Action) ? statement.Action : [statement.Action],
  ));
  for (const action of [
    "secretsmanager:GetSecretValue",
    "ecs:UpdateService",
    "ecs:RegisterTaskDefinition",
    "ecs:DeregisterTaskDefinition",
    "ecs:RunTask",
    "rds:ModifyDBInstance",
    "rds:DeleteDBInstance",
    "ec2:AuthorizeSecurityGroupIngress",
    "ec2:RevokeSecurityGroupEgress",
    "cloudformation:UpdateStack",
    "cloudformation:ExecuteChangeSet",
  ]) {
    assert.ok(actions.has(action), `missing deny action ${action}`);
  }
  assert.ok(policy.Statement.every((statement) => statement.Effect === "Deny"));
});

test("Windows policy file URI is passed unchanged to the AWS version call", async () => {
  const oldPolicy = { PolicyVersion: { Document: await approvedPreviousPolicy() } };
  const { calls } = await runRefresh({ policy: oldPolicy });
  const create = calls.find((call) => call[1] === "create-policy-version");
  assert.ok(create);
  assert.equal(create[create.indexOf("--policy-document") + 1], policyFileUri);
  assert.match(create[create.indexOf("--policy-document") + 1], /^file:\/\/C:\\/);
});
