import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse((await readFile(resolve(repoRoot, path), "utf8")).replace(/^\uFEFF/, ""));
}

test("authorization identity plan enforces explicit restricted principal and minimum writer scope", async () => {
  const plan = await readJson("infra/staging/s2g-db-admin-authorization-identity.plan.json");
  assert.equal(plan.status, "draft-not-applied");
  assert.equal(plan.stackName, "GenesisStagingS2gDbAdminAuthorizationIdentityStack");
  assert.equal(plan.restrictedCreatorSourcePrincipal.parameter, "RestrictedCreatorSourcePrincipalArn");
  assert.equal(plan.restrictedCreatorSourcePrincipal.required, true);
  assert.equal(plan.authorizationWriterRole.roleName, "genesis-staging-s2g-db-admin-authorization-writer-role");
  assert.deepEqual(plan.authorizationWriterRole.allowedActions, ["dynamodb:PutItem"]);
  assert.ok(plan.authorizationWriterRole.forbiddenActions.includes("dynamodb:UpdateItem"));
  assert.ok(plan.authorizationWriterRole.forbiddenActions.includes("ecs:RunTask"));
  assert.ok(plan.authorizationWriterRole.forbiddenActions.includes("lambda:InvokeFunctionUrl"));
  assert.ok(
    plan.authorizationWriterRole.conditions["ForAllValues:StringLike"]["dynamodb:LeadingKeys"]
      .includes("s2g-dbdiag-*"),
  );
  assert.equal(plan.authorizationWriterRole.conditions.Null["dynamodb:LeadingKeys"], "false");
  assert.equal(plan.identityCenterPermissionSetDesign.name, "GenesisS2GDiagnosticAuthorizationCreator");
  assert.deepEqual(plan.identityCenterPermissionSetDesign.managedPolicies, []);
  assert.deepEqual(
    plan.identityCenterPermissionSetDesign.inlinePolicy.Statement[0].Action,
    ["sts:AssumeRole"],
  );
  assert.match(
    plan.identityCenterPermissionSetDesign.inlinePolicy.Statement[0].Resource,
    /genesis-staging-s2g-db-admin-authorization-writer-role$/,
  );
  assert.ok(plan.provisioningSequence.length >= 5);
  assert.ok(plan.residualGovernanceRisks.length > 0);
});
