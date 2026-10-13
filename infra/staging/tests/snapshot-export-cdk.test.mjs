import assert from "node:assert/strict";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import test from "node:test";
import { createStagingSnapshotExportStack } from "../snapshot-export/cdk/staging-snapshot-export-stack.mjs";

function synthTemplate() {
  const app = new App();
  const stack = createStagingSnapshotExportStack(app, "TestStagingSnapshotExportStack");
  return Template.fromStack(stack).toJSON();
}

test("synthesizes isolated staging snapshot export stack with secure S3 and KMS posture", () => {
  const template = synthTemplate();
  const templateText = JSON.stringify(template);
  assert.match(templateText, /StagingSnapshotArtifactBucket/);
  assert.match(templateText, /StagingSnapshotArtifactKey/);
  assert.match(templateText, /BucketOwnerEnforced/);
  assert.match(templateText, /BlockPublicAcls/);
  assert.match(templateText, /IgnorePublicAcls/);
  assert.match(templateText, /BlockPublicPolicy/);
  assert.match(templateText, /RestrictPublicBuckets/);
  assert.match(templateText, /aws:kms/);
  assert.match(templateText, /DenySnapshotUploadsWithoutKms/);
  assert.match(templateText, /DenySnapshotUploadsWithUnauthorizedKmsKey/);
  assert.match(templateText, /DenySnapshotUploadsWithPublicAcl/);
  assert.match(templateText, /"Status":"Enabled"/);
  assert.match(templateText, /"ExpirationInDays":2/);
});

test("synthesized IAM policies remain least privilege for exporter/reader/operator", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  assert.match(json, /RunApprovedStagingSnapshotTaskOnly/);
  assert.match(json, /PassOnlyApprovedSnapshotTaskRoles/);
  assert.match(json, /ReadRunScopedArtifactsOnly/);
  assert.match(json, /EncryptSnapshotArtifactsWithDedicatedKey/);
  assert.doesNotMatch(json, /ecs:UpdateService|rds:ModifyDBInstance|cloudformation:ExecuteChangeSet/);
  assert.doesNotMatch(json, /genesis-production-artifacts-452630323448-us-west-2/);
});

test("negative isolation: stack template does not reference production runtime stack or production services", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  assert.doesNotMatch(json, /GenesisRuntimeStack/);
  assert.doesNotMatch(json, /genesis-production-web/);
  assert.doesNotMatch(json, /genesis-share-to-grow-production/);
});

