import assert from "node:assert/strict";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import test from "node:test";
import { createStagingS2gDbAdminLauncherStack } from "../s2g-db-admin-launcher/cdk/staging-s2g-db-admin-launcher-stack.mjs";

function synthTemplate() {
  const app = new App();
  const stack = createStagingS2gDbAdminLauncherStack(app, "TestStagingS2gDbAdminLauncherStack");
  return Template.fromStack(stack).toJSON();
}

test("synthesizes isolated diagnostic launcher stack with disabled bootstrap and fixed task-family pattern", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  assert.match(json, /DbAdminDiagnosticLauncherFunction/);
  assert.match(json, /DbAdminDiagnosticLaunchTable/);
  assert.match(json, /"LauncherActivationState"/);
  assert.match(json, /"Default":"DISABLED"/);
  assert.match(json, /"AllowedValues":\["DISABLED","ENABLED"\]/);
  assert.match(json, /"ApprovedDiagnosticTaskDefinitionArn"/);
  assert.match(json, /genesis-staging-s2g-db-admin-diagnostic:\[1-9\]\[0-9\]\*/);
  assert.match(json, /"Default":""/);
});

test("launcher IAM enforces fixed invoke path and excludes direct operator ecs permissions", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  assert.match(json, /RunApprovedDiagnosticTaskOnly/);
  assert.match(json, /PassOnlyDedicatedDiagnosticTaskRoles/);
  assert.match(json, /InvokeDbAdminDiagnosticLauncherOnly/);
  assert.match(json, /AWS_IAM/);
  assert.match(json, /Condition":"LauncherEnabledCondition"/);
  assert.doesNotMatch(json, /StagingS2gDbAdminDiagnosticOperatorRole[\s\S]*ecs:RunTask/);
  assert.doesNotMatch(json, /StagingS2gDbAdminDiagnosticOperatorRole[\s\S]*iam:PassRole/);
  assert.doesNotMatch(json, /GenesisRuntimeStack/);
  assert.doesNotMatch(json, /genesis-production-web/);
  assert.doesNotMatch(json, /genesis-share-to-grow-production/);
});
