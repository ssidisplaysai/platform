import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSecurityGroupPath,
  filterTaskDefinition,
  isAccessDenied,
  isGenesisManagedPolicyArn,
  isTrackedImageDigest,
  productionImageReference,
  READ_ONLY_AWS_CALLS,
  sanitizeCloudTrailEvent,
  sanitizeRequestParameters,
  sanitizeSecretMetadata,
  summarizeIamPolicyDocument,
  summarizeRunningTask,
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

test("managed policy metadata inspection is restricted to Genesis customer-managed policies", () => {
  assert.equal(isGenesisManagedPolicyArn(
    "arn:aws:iam::452630323448:policy/GenesisRuntimeStack-RuntimePolicy",
  ), true);
  assert.equal(isGenesisManagedPolicyArn(
    "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-01-read-only-production-inspection",
  ), true);
  assert.equal(isGenesisManagedPolicyArn(
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  ), false);
  assert.equal(isGenesisManagedPolicyArn(
    "arn:aws:iam::452630323448:policy/UnrelatedPolicy",
  ), false);
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

test("secret metadata sanitizer maps AWS CLI fields and includes task binding without values", () => {
  const result = sanitizeSecretMetadata({
    Name: "genesis/production/wordpress",
    ARN: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/wordpress-AbCdEf",
    Description: "Production integration credentials",
    KmsKeyId: "arn:aws:kms:us-west-2:452630323448:key/12345678",
    LastChangedDate: "2026-10-09T00:00:00.000Z",
    LastAccessedDate: "2026-10-08T00:00:00.000Z",
    RotationEnabled: true,
    RotationRules: { AutomaticallyAfterDays: 30 },
    SecretString: "never-expose-this",
  }, {
    names: ["WORDPRESS_APP_PASSWORD", "WORDPRESS_USERNAME"],
    arn: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/wordpress-AbCdEf",
  });
  assert.deepEqual(result, {
    taskBindingNames: ["WORDPRESS_APP_PASSWORD", "WORDPRESS_USERNAME"],
    taskSecretArn: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/wordpress-AbCdEf",
    name: "genesis/production/wordpress",
    arn: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/wordpress-AbCdEf",
    description: "Production integration credentials",
    kmsKeyId: "arn:aws:kms:us-west-2:452630323448:key/12345678",
    lastChangedDate: "2026-10-09T00:00:00.000Z",
    lastAccessedDate: "2026-10-08T00:00:00.000Z",
    rotationEnabled: true,
    rotationRules: { AutomaticallyAfterDays: 30 },
  });
  assert.equal(JSON.stringify(result).includes("never-expose-this"), false);
});

test("IAM policy summary reports read-safe authorization statements", () => {
  assert.deepEqual(summarizeIamPolicyDocument({
    Version: "2012-10-17",
    Statement: [{
      Sid: "ReadPolicy",
      Effect: "Allow",
      Action: ["iam:GetPolicy"],
      Resource: "arn:aws:iam::452630323448:policy/GenesisRuntimeStack-*",
      Condition: { StringEquals: { "aws:RequestedRegion": "us-west-2" } },
    }],
  }), [{
    sid: "ReadPolicy",
    effect: "Allow",
    action: ["iam:GetPolicy"],
    resource: "arn:aws:iam::452630323448:policy/GenesisRuntimeStack-*",
    notAction: undefined,
    notResource: undefined,
    condition: { StringEquals: { "aws:RequestedRegion": "us-west-2" } },
  }]);
});

test("running task summary exposes health, start time, ENI and container image digest", () => {
  const result = summarizeRunningTask({
    taskArn: "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/task-id",
    taskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:59",
    lastStatus: "RUNNING",
    desiredStatus: "RUNNING",
    healthStatus: "UNKNOWN",
    launchType: "FARGATE",
    startedAt: "2026-10-10T01:26:14Z",
    attachments: [{
      type: "ElasticNetworkInterface",
      details: [
        { name: "subnetId", value: "subnet-prod" },
        { name: "networkInterfaceId", value: "eni-prod" },
        { name: "privateIPv4Address", value: "10.0.0.1" },
      ],
    }],
    containers: [{
      name: "GenesisWebRuntime",
      lastStatus: "RUNNING",
      healthStatus: "UNKNOWN",
      image: "runtime@sha256:abc",
      imageDigest: "sha256:abc",
    }],
  }, { securityGroups: ["sg-prod"] });
  assert.equal(result.startedAt, "2026-10-10T01:26:14Z");
  assert.deepEqual(result.securityGroups, ["sg-prod"]);
  assert.equal(result.attachments[0].details[1].value, "eni-prod");
  assert.equal(result.containers[0].imageDigest, "sha256:abc");
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

test("security-group connectivity accepts AWS DescribeSecurityGroups field casing", () => {
  const result = evaluateSecurityGroupPath({
    taskGroupIds: ["sg-app"],
    taskVpcId: "vpc-1",
    taskSubnets: [{ subnetId: "subnet-app", vpcId: "vpc-1" }],
    dbVpcId: "vpc-1",
    dbPort: 5432,
    dbSecurityGroups: [{
      GroupId: "sg-db",
      IpPermissions: [{
        IpProtocol: "tcp",
        FromPort: 5432,
        ToPort: 5432,
        UserIdGroupPairs: [{ GroupId: "sg-app" }],
      }],
    }],
  });
  assert.equal(result.configurationAllows, true);
  assert.deepEqual(result.securityGroupIngressFromTask, [{
    dbSecurityGroupId: "sg-db",
    sourceGroupId: "sg-app",
    dbPort: 5432,
  }]);
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
