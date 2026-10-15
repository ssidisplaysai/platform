import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("diagnostic launcher plan enforces disabled bootstrap and fixed launch boundaries", async () => {
  const plan = await readJson("infra/staging/s2g-db-admin-launcher-permissions.plan.json");
  assert.equal(plan.status, "draft-not-applied");
  assert.equal(plan.activationModel.default, "DISABLED");
  assert.deepEqual(plan.activationModel.allowedValues, ["DISABLED", "ENABLED"]);
  assert.equal(plan.approvedDiagnosticTaskFamily, "genesis-staging-s2g-db-admin-diagnostic");
  assert.equal(plan.approvedImageDigest, "sha256:4603f32f34be3dcf4c4c80fee1c521d2427fc95b54d6e031fb0fa868143be7b5");
  assert.equal(plan.network.assignPublicIp, "DISABLED");
  assert.equal(plan.network.enableExecuteCommand, false);
  assert.equal(plan.network.identity, "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production|subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c|sg-0e9dcd277642bdb63");
  assert.deepEqual(plan.fixedCommand, [
    "node",
    "scripts/staging-s2g-db-admin-diagnostic.mjs",
  ]);
  assert.equal(plan.authorization.schemaVersion, "2026-10-13");
  assert.equal(plan.authorization.purpose, "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC");
  assert.equal(plan.authorization.claimTransition.from, "AUTHORIZED");
  assert.equal(plan.authorization.claimTransition.to, "CLAIMED");
  assert.equal(plan.authorization.claimTransition.upsertAllowed, false);
  assert.equal(plan.canonicalAuthorizationWriterBoundary.roleName, "genesis-staging-s2g-db-admin-authorization-writer-role");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.sourcePrincipalRoleName, "AWSReservedSSO_GenesisS2GDiagAuthCreator_a8cbf54ac63d3f12");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.assumeRoleRestriction, "Source principal may assume canonical writer role only.");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.requiredConditionExpression, "attribute_not_exists(runId)");
  assert.deepEqual(plan.canonicalAuthorizationWriterBoundary.allowedActions, ["dynamodb:PutItem"]);
  assert.equal(plan.canonicalAuthorizationWriterBoundary.leadingKeyPrefix, "s2g-dbdiag-*");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.requiredLeadingKeyCondition["ForAllValues:StringLike"], "dynamodb:LeadingKeys");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.requiredLeadingKeyCondition.Null["dynamodb:LeadingKeys"], "false");
  assert.equal(plan.canonicalAuthorizationWriterBoundary.expirationSecondsDefault, 300);
  assert.equal(plan.canonicalAuthorizationWriterBoundary.maxLaunchAttempts, 1);
  assert.ok(plan.newRoles.some((role) =>
    role.roleName === "genesis-staging-s2g-db-admin-authorization-writer-role"));
  assert.ok(!plan.newRoles.some((role) =>
    role.roleLogicalName === "StagingS2gDbAdminDiagnosticAuthorizationCreatorRole"));
  assert.equal(plan.operatorTrustBoundary.operatorRoleLogicalName, "StagingS2gDbAdminDiagnosticOperatorRole");
  assert.equal(plan.operatorTrustBoundary.legacyTrustedPrincipalParameter, "OperatorPrincipalArn");
  assert.equal(plan.operatorTrustBoundary.restrictedTrustedPrincipalParameter, "OperatorAssumerPrincipalArn");
  assert.equal(plan.operatorTrustBoundary.restrictedPermissionSetName, "GenesisS2GDiagOperator");
  assert.deepEqual(plan.operatorTrustBoundary.restrictedPermissionSetScope.allowedActions, ["sts:AssumeRole"]);
  assert.equal(
    plan.operatorTrustBoundary.restrictedPermissionSetScope.allowedResource,
    "arn:aws:iam::452630323448:role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma",
  );
  assert.ok(plan.operatorTrustBoundary.restrictedPermissionSetScope.prohibitedDirectActions.includes("lambda:InvokeFunctionUrl"));
  assert.ok(plan.operatorTrustBoundary.restrictedPermissionSetScope.prohibitedDirectActions.includes("dynamodb:PutItem"));
  assert.equal(plan.operatorTrustBoundary.rolloutStages.length, 6);
  assert.ok(plan.operatorRestrictions.includes("No direct ecs:RunTask permission"));
  assert.ok(plan.operatorRestrictions.includes("No direct iam:PassRole permission"));
  assert.ok(
    plan.operatorRestrictions.includes(
      "Function URL invocation requires lambda:InvokeFunctionUrl and lambda:InvokeFunction with lambda:InvokedViaFunctionUrl=true",
    ),
  );
  assert.deepEqual(plan.secretBoundary.allowedActions, ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]);
});
