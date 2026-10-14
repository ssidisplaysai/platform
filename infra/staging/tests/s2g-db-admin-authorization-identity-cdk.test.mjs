import assert from "node:assert/strict";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import test from "node:test";
import { createStagingS2gDbAdminAuthorizationIdentityStack } from "../s2g-db-admin-authorization-identity/cdk/staging-s2g-db-admin-authorization-identity-stack.mjs";

function synthTemplate() {
  const app = new App();
  const stack = createStagingS2gDbAdminAuthorizationIdentityStack(app, "TestStagingS2gDbAdminAuthorizationIdentityStack");
  return Template.fromStack(stack).toJSON();
}

test("synthesizes isolated authorization identity stack with explicit restricted principal parameter", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  const principalParameter = template.Parameters.RestrictedCreatorSourcePrincipalArn;
  assert.ok(principalParameter);
  assert.equal(principalParameter.Type, "String");
  assert.equal(principalParameter.Default, undefined);
  assert.equal(principalParameter.AllowedPattern, "^arn:aws:iam::452630323448:role/[A-Za-z0-9+=,.@_\\/-]{1,128}$");
  assert.match(json, /RestrictedCreatorSourcePrincipalMustNotBeAdministratorAccessRole/);
  assert.match(json, /must not be the AWSReservedSSO AdministratorAccess role/);
});

test("authorization-writer policy allows only conditional PutItem on exact staging table", () => {
  const template = synthTemplate();
  const writerPolicy = Object.values(template.Resources).find((resource) =>
    resource?.Type === "AWS::IAM::Policy"
    && resource?.Properties?.PolicyDocument?.Statement?.some((statement) => statement?.Sid === "CreateDiagnosticLaunchAuthorizationOnly"));
  assert.ok(writerPolicy);
  const statement = writerPolicy.Properties.PolicyDocument.Statement.find((item) =>
    item?.Sid === "CreateDiagnosticLaunchAuthorizationOnly");
  assert.equal(statement.Effect, "Allow");
  assert.deepEqual(statement.Action, "dynamodb:PutItem");
  assert.deepEqual(statement.Resource, { Ref: "DiagnosticAuthorizationTableArn" });
  const tableParameter = template.Parameters.DiagnosticAuthorizationTableArn;
  assert.ok(tableParameter);
  assert.match(tableParameter.AllowedPattern, /genesis-staging-s2g-db-admin-diagnostic-launches/);
  assert.deepEqual(
    statement.Condition,
    {
      "ForAllValues:StringLike": {
        "dynamodb:LeadingKeys": ["s2g-dbdiag-*"],
      },
      "Null": {
        "dynamodb:LeadingKeys": "false",
      },
    },
  );
  const writerActions = writerPolicy.Properties.PolicyDocument.Statement
    .flatMap((item) => (Array.isArray(item.Action) ? item.Action : [item.Action]));
  assert.ok(!writerActions.includes("dynamodb:UpdateItem"));
  assert.ok(!writerActions.includes("dynamodb:DeleteItem"));
  assert.ok(!writerActions.includes("dynamodb:Scan"));
  assert.ok(!writerActions.includes("ecs:RunTask"));
  assert.ok(!writerActions.includes("iam:PassRole"));
  assert.ok(!writerActions.includes("lambda:InvokeFunctionUrl"));
  assert.ok(!writerActions.includes("lambda:InvokeFunction"));
});

test("negative isolation: stack template does not reference launcher/runtime/production resources", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  assert.doesNotMatch(json, /GenesisRuntimeStack/);
  assert.doesNotMatch(json, /genesis-production-web/);
  assert.doesNotMatch(json, /genesis-share-to-grow-production/);
  assert.doesNotMatch(json, /genesis-staging-web/);
  assert.doesNotMatch(json, /DbAdminDiagnosticLauncherFunction/);
  assert.doesNotMatch(json, /SnapshotLaunchBrokerFunction/);
});
