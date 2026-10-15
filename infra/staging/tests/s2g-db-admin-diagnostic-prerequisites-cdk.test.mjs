import assert from "node:assert/strict";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import test from "node:test";
import { createStagingS2gDbAdminDiagnosticPrerequisitesStack } from "../s2g-db-admin-diagnostic-prerequisites/cdk/staging-s2g-db-admin-diagnostic-prerequisites-stack.mjs";

function synthTemplate() {
  const app = new App();
  const stack = createStagingS2gDbAdminDiagnosticPrerequisitesStack(app, "TestS2gDbAdminDiagnosticPrerequisitesStack");
  return Template.fromStack(stack).toJSON();
}

function resourceByLogicalPrefix(resources, type, prefix) {
  return Object.entries(resources).find(([logicalId, resource]) =>
    logicalId.startsWith(prefix) && resource.Type === type)?.[1];
}

test("synthesizes isolated prerequisites resources for diagnostic IAM, network, ECR, and logs only", () => {
  const template = synthTemplate();
  const json = JSON.stringify(template);
  const resources = template.Resources;
  const resourceTypes = Object.values(resources).map((resource) => resource.Type);

  assert.equal(resourceTypes.filter((type) => type === "AWS::IAM::Role").length, 2);
  assert.equal(resourceTypes.filter((type) => type === "AWS::IAM::Policy").length, 1);
  assert.equal(resourceTypes.filter((type) => type === "AWS::EC2::SecurityGroup").length, 1);
  assert.equal(resourceTypes.filter((type) => type === "AWS::EC2::SecurityGroupEgress").length, 0);
  assert.equal(resourceTypes.filter((type) => type === "AWS::EC2::SecurityGroupIngress").length, 1);
  assert.equal(resourceTypes.filter((type) => type === "AWS::ECR::Repository").length, 1);
  assert.equal(resourceTypes.filter((type) => type === "AWS::Logs::LogGroup").length, 1);
  assert.doesNotMatch(json, /AWS::ECS::TaskDefinition|AWS::Lambda::Function|AWS::DynamoDB::Table/);
  assert.doesNotMatch(json, /GenesisRuntimeStack|genesis-production-web|genesis-share-to-grow-production/);
});

test("execution and task roles preserve trust and least-privilege boundaries", () => {
  const template = synthTemplate();
  const resources = template.Resources;
  const executionRole = resourceByLogicalPrefix(resources, "AWS::IAM::Role", "S2gDbAdminDiagnosticExecutionRole");
  const taskRole = resourceByLogicalPrefix(resources, "AWS::IAM::Role", "S2gDbAdminDiagnosticTaskRole");
  const executionPolicy = resourceByLogicalPrefix(resources, "AWS::IAM::Policy", "S2gDbAdminDiagnosticExecutionRoleDefaultPolicy");
  const executionPolicyText = JSON.stringify(executionPolicy?.Properties?.PolicyDocument ?? {});

  assert.equal(executionRole.Properties.RoleName, "genesis-staging-s2g-db-role-provision-execution-role");
  assert.equal(taskRole.Properties.RoleName, "genesis-staging-s2g-db-role-provision-task-role");
  assert.deepEqual(executionRole.Properties.AssumeRolePolicyDocument.Statement[0].Principal, { Service: "ecs-tasks.amazonaws.com" });
  assert.deepEqual(taskRole.Properties.AssumeRolePolicyDocument.Statement[0].Principal, { Service: "ecs-tasks.amazonaws.com" });

  assert.match(executionPolicyText, /"ecr:GetAuthorizationToken"/);
  assert.match(executionPolicyText, /"Resource":"\*"/);
  assert.match(executionPolicyText, /ReadOnlyDedicatedDiagnosticRepository/);
  assert.match(executionPolicyText, /WriteOnlyDedicatedDiagnosticLogStream/);
  assert.match(executionPolicyText, /secretsmanager:GetSecretValue/);
  assert.match(executionPolicyText, /ReadExactStagingRdsAdminSecret/);
  assert.doesNotMatch(executionPolicyText, /secretsmanager:\*|kms:\*|iam:\*|ecs:RunTask/);
});

test("network, ECR, and logging controls match approved staging boundary", () => {
  const template = synthTemplate();
  const resources = template.Resources;
  const sg = resourceByLogicalPrefix(resources, "AWS::EC2::SecurityGroup", "S2gDbAdminDiagnosticSecurityGroup");
  const ingress = resourceByLogicalPrefix(resources, "AWS::EC2::SecurityGroupIngress", "S2gDbAdminDiagnosticRdsIngress");
  const repo = resourceByLogicalPrefix(resources, "AWS::ECR::Repository", "S2gDbAdminDiagnosticRepository");
  const logGroup = resourceByLogicalPrefix(resources, "AWS::Logs::LogGroup", "S2gDbAdminDiagnosticLogGroup");
  const egressText = JSON.stringify(sg.Properties.SecurityGroupEgress ?? []);

  assert.equal(sg.Properties.GroupName, "genesis-staging-s2g-db-admin-diagnostic-sg");
  assert.equal(sg.Properties.SecurityGroupIngress, undefined);
  assert.match(egressText, /"FromPort":5432/);
  assert.match(egressText, /"ToPort":5432/);
  assert.match(egressText, /"DestinationSecurityGroupId"/);
  assert.match(egressText, /"FromPort":443/);
  assert.match(egressText, /"CidrIp":"0\.0\.0\.0\/0"/);

  assert.equal(ingress.Properties.FromPort, 5432);
  assert.equal(ingress.Properties.ToPort, 5432);
  assert.equal(ingress.Properties.IpProtocol, "tcp");

  assert.equal(repo.Properties.RepositoryName, "genesis-staging-s2g-db-admin-diagnostic");
  assert.equal(repo.Properties.ImageTagMutability, "IMMUTABLE");
  assert.equal(repo.Properties.ImageScanningConfiguration.ScanOnPush, true);
  assert.equal(logGroup.Properties.LogGroupName, "/genesis/staging/s2g-db-admin-diagnostic");
  assert.equal(logGroup.Properties.RetentionInDays, 30);
});
