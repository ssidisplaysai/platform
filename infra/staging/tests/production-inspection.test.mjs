import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSecurityGroupPath,
  filterTaskDefinition,
  isAccessDenied,
  isTrackedImageDigest,
  productionImageReference,
  READ_ONLY_AWS_CALLS,
  sanitizeCloudTrailEvent,
  sanitizeRequestParameters,
  sanitizeSecretMetadata,
  summarizeAlarmInventory,
  summarizeAlarm,
  summarizeRdsResource,
  taskDefinitionArnsToInspect,
} from "../production-inspection.mjs";

test("production inspection calls only the read-only API allowlist", () => {
  for (const action of [
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
  ]) {
    assert.ok(READ_ONLY_AWS_CALLS.has(action), `${action} must be allowlisted`);
  }
  for (const action of READ_ONLY_AWS_CALLS) {
    assert.doesNotMatch(
      action,
      /:(?:Create|Update|Delete|Put|Modify|Register|Deregister|Authorize|Revoke|Attach|Detach|Pass|Set|Run|Execute|Start|Stop|Terminate|Send|Publish|Invoke|Write|Add|Remove)/i,
      `${action} must remain read-only`,
    );
  }
});

test("CloudTrail sanitization handles taskDefinition as ARN string and omits unsafe request fields", () => {
  const output = sanitizeCloudTrailEvent({
    eventTime: "2026-10-09T23:20:00Z",
    eventName: "UpdateService",
    userAgent: "aws-cli/2",
    sourceIPAddress: "203.0.113.4",
    userIdentity: {
      type: "AssumedRole",
      arn: "arn:aws:sts::452630323448:assumed-role/Deploy/session-abc",
      principalId: "ROLEID:session-abc",
      sessionContext: { sessionIssuer: { arn: "arn:aws:iam::452630323448:role/Deploy" } },
    },
    requestParameters: {
      service: "genesis-production-web",
      taskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:56",
      environment: [{ name: "SECRET", value: "must-not-appear" }],
    },
  });
  assert.equal(output.taskDefinitionRevision, 56);
  assert.equal(output.ecsService, "genesis-production-web");
  assert.equal(output.roleSessionName, "session-abc");
  assert.equal(JSON.stringify(output).includes("must-not-appear"), false);
  assert.deepEqual(sanitizeRequestParameters({
    taskDefinition: "arn:aws:ecs:task-definition/genesis-production-web:56",
    DB_PASSWORD: "hidden",
  }), { taskDefinition: "arn:aws:ecs:task-definition/genesis-production-web:56" });
});

test("CloudTrail sanitization supports structured taskDefinition fields", () => {
  const output = sanitizeCloudTrailEvent({
    eventName: "RegisterTaskDefinition",
    requestParameters: { taskDefinition: { family: "genesis-production-web", revision: 55, taskDefinitionArn: "arn:aws:ecs:task-definition/genesis-production-web:55" } },
  });
  assert.equal(output.taskDefinitionRevision, 55);
  assert.deepEqual(output.requestParameters.taskDefinition, {
    family: "genesis-production-web", revision: 55,
    taskDefinitionArn: "arn:aws:ecs:task-definition/genesis-production-web:55",
  });
});

test("task-definition revision filtering excludes unrelated families and revisions", () => {
  assert.equal(filterTaskDefinition({ family: "genesis-production-web", revision: 56 }, 56), true);
  assert.equal(filterTaskDefinition({ family: "genesis-production-web", revision: 55 }, 56), false);
  assert.equal(filterTaskDefinition({ family: "other", revision: 56 }, 56), false);
});

test("task-definition lookup always includes revisions 55, 56, 57 and the active revision", () => {
  const active = "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:61";
  const arns = taskDefinitionArnsToInspect([], active);
  for (const revision of [55, 56, 57, 61]) {
    assert.ok(arns.some((arn) => arn.endsWith(`:${revision}`)));
  }
  assert.equal(arns.length, new Set(arns).size);
});

test("production image references are resolved only for the tracked ECR repository", () => {
  assert.deepEqual(productionImageReference(
    "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-production-runtime:runtime-tag",
  ), { imageId: "imageTag=runtime-tag", tag: "runtime-tag" });
  assert.deepEqual(productionImageReference(
    "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-production-runtime@sha256:abc",
  ), { imageId: "imageDigest=sha256:abc", tag: null });
  assert.equal(productionImageReference("public.ecr.aws/example/runtime:latest"), null);
});

test("image digest filtering accepts only the two audited production digests", () => {
  assert.equal(isTrackedImageDigest("sha256:f0955c71791e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1"), false);
  assert.equal(isTrackedImageDigest("sha256:f0955c71791e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1"), false);
  assert.equal(isTrackedImageDigest("sha256:f0955c71791e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1e9e1"), false);
  assert.equal(isTrackedImageDigest("sha256:fa8edfa7fd779a43d28e74ff6e479de2a3b4eb95cb964217f484ab47e0d8ce73"), true);
  assert.equal(isTrackedImageDigest("sha256:f0955c71791a7293969e1e49163e900073dcce06d01fc065e62c4bac7979d5ee"), true);
});

test("RDS summary retains durability metadata but never returns credentials", () => {
  const result = summarizeRdsResource({
    DBInstanceIdentifier: "genesis-db",
    Engine: "postgres",
    EngineVersion: "16.2",
    Endpoint: { Address: "db.internal", Port: 5432 },
    StorageEncrypted: true,
    KmsKeyId: "kms-key-id",
    BackupRetentionPeriod: 7,
    DeletionProtection: true,
    PubliclyAccessible: false,
    MasterUserPassword: "must-not-appear",
    VpcSecurityGroups: [{ VpcSecurityGroupId: "sg-db", Status: "active" }],
  });
  assert.equal(result.engine, "postgres");
  assert.equal(result.endpoint.port, 5432);
  assert.equal(result.storageEncrypted, true);
  assert.equal(JSON.stringify(result).includes("must-not-appear"), false);
});

test("secret metadata sanitizer cannot expose a secret value", () => {
  const result = sanitizeSecretMetadata({ name: "db", arn: "secret-arn", secretString: "private-value", kmsKeyId: "kms" });
  assert.equal(result.name, "db");
  assert.equal(JSON.stringify(result).includes("private-value"), false);
});

test("security-group connectivity requires same VPC and DB ingress from task group on DB port", () => {
  const result = evaluateSecurityGroupPath({
    taskGroupIds: ["sg-app"],
    taskVpcId: "vpc-1",
    taskSubnets: [{ subnetId: "subnet-app", vpcId: "vpc-1" }],
    dbVpcId: "vpc-1",
    dbPort: 5432,
    dbSecurityGroups: [{
      groupId: "sg-db",
      ipPermissions: [{ ipProtocol: "tcp", fromPort: 5432, toPort: 5432, userIdGroupPairs: [{ groupId: "sg-app" }] }],
    }],
  });
  assert.equal(result.configurationAllows, true);
  assert.equal(result.securityGroupIngressFromTask[0].sourceGroupId, "sg-app");
});

test("alarm inventory summary captures identifying metadata", () => {
  assert.deepEqual(summarizeAlarm({
    AlarmName: "production-target-5xx",
    StateValue: "OK",
    Namespace: "AWS/ApplicationELB",
    MetricName: "HTTPCode_Target_5XX_Count",
    Dimensions: [{ Name: "LoadBalancer", Value: "lb/production" }],
  }), {
    name: "production-target-5xx", type: "MetricAlarm", state: "OK",
    actionsEnabled: undefined, alarmRule: undefined, namespace: "AWS/ApplicationELB",
    metric: "HTTPCode_Target_5XX_Count", metrics: [],
    dimensions: [{ Name: "LoadBalancer", Value: "lb/production" }],
    threshold: undefined, evaluationPeriods: undefined, comparisonOperator: undefined,
  });
});

test("alarm inventory summary includes metric and composite alarms", () => {
  assert.deepEqual(summarizeAlarmInventory({
    MetricAlarms: [{ AlarmName: "service-5xx", StateValue: "OK" }],
    CompositeAlarms: [{
      AlarmName: "production-health",
      StateValue: "ALARM",
      AlarmRule: "ALARM(service-5xx)",
    }],
  }), [
    {
      name: "service-5xx", type: "MetricAlarm", state: "OK",
      actionsEnabled: undefined, alarmRule: undefined, namespace: undefined, metric: undefined,
      metrics: [], dimensions: undefined, threshold: undefined,
      evaluationPeriods: undefined, comparisonOperator: undefined,
    },
    {
      name: "production-health", type: "CompositeAlarm", state: "ALARM",
      actionsEnabled: undefined, alarmRule: "ALARM(service-5xx)", namespace: undefined, metric: undefined,
      metrics: [], dimensions: undefined, threshold: undefined,
      evaluationPeriods: undefined, comparisonOperator: undefined,
    },
  ]);
});

test("AccessDenied responses are identified for narrow permission-gap reporting", () => {
  assert.equal(isAccessDenied("AccessDeniedException: not authorized to perform rds:DescribeDBInstances"), true);
  assert.equal(isAccessDenied("Could not connect to endpoint"), false);
});
