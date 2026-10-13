import cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const brokerAssetPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "broker");

export function createStagingSnapshotExportStack(app, id = "GenesisStagingSnapshotExportStack", props = {}) {
  const stack = new cdk.Stack(app, id, props);

  const artifactRetentionDays = props.artifactRetentionDays ?? 2;
  if (!Number.isInteger(artifactRetentionDays) || artifactRetentionDays < 1 || artifactRetentionDays > 3) {
    throw new Error("ARTIFACT_RETENTION_DAYS_INVALID");
  }

  const operatorPrincipalArn = new cdk.CfnParameter(stack, "OperatorPrincipalArn", {
    type: "String",
    description: "IAM principal ARN allowed to assume the staging snapshot operator role.",
  });
  const stagingClusterArn = new cdk.CfnParameter(stack, "StagingClusterArn", {
    type: "String",
    default: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
  });
  const approvedTaskDefinitionArn = new cdk.CfnParameter(stack, "ApprovedSnapshotTaskDefinitionArn", {
    type: "String",
    description: "Exact approved staging snapshot export task definition ARN including revision.",
  });
  const stagingTaskExecutionRoleArn = new cdk.CfnParameter(stack, "StagingTaskExecutionRoleArn", {
    type: "String",
    default: "arn:aws:iam::452630323448:role/genesis-staging-execution-role",
  });
  const stagingSubnets = new cdk.CfnParameter(stack, "StagingSubnets", {
    type: "CommaDelimitedList",
    default: "subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c",
  });
  const stagingSecurityGroups = new cdk.CfnParameter(stack, "StagingSecurityGroups", {
    type: "CommaDelimitedList",
    default: "sg-0687242229bc3a80e",
  });

  const snapshotAuthorizationTable = new dynamodb.Table(stack, "SnapshotRunAuthorizationTable", {
    tableName: "genesis-staging-s2g-snapshot-run-authorizations",
    partitionKey: {
      name: "runId",
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    timeToLiveAttribute: "expiresAtEpoch",
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  const snapshotKey = new kms.Key(stack, "StagingSnapshotArtifactKey", {
    enableKeyRotation: true,
    description: "Staging-only KMS key for Share-to-Grow financial snapshot artifacts.",
    alias: "alias/genesis-staging-s2g-snapshot-artifacts",
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  const snapshotBucket = new s3.Bucket(stack, "StagingSnapshotArtifactBucket", {
    bucketName: `genesis-staging-s2g-snapshot-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    enforceSSL: true,
    encryption: s3.BucketEncryption.KMS,
    encryptionKey: snapshotKey,
    versioned: true,
    lifecycleRules: [{
      id: "staging-snapshot-expiration",
      enabled: true,
      prefix: "exports/",
      expiration: cdk.Duration.days(artifactRetentionDays),
      noncurrentVersionExpiration: cdk.Duration.days(artifactRetentionDays),
      abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
    }],
  });

  snapshotBucket.addToResourcePolicy(new iam.PolicyStatement({
    sid: "DenySnapshotUploadsWithoutKms",
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ["s3:PutObject"],
    resources: [snapshotBucket.arnForObjects("exports/*")],
    conditions: {
      StringNotEquals: { "s3:x-amz-server-side-encryption": "aws:kms" },
    },
  }));

  snapshotBucket.addToResourcePolicy(new iam.PolicyStatement({
    sid: "DenySnapshotUploadsWithUnauthorizedKmsKey",
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ["s3:PutObject"],
    resources: [snapshotBucket.arnForObjects("exports/*")],
    conditions: {
      StringNotEquals: { "s3:x-amz-server-side-encryption-aws-kms-key-id": snapshotKey.keyArn },
    },
  }));

  snapshotBucket.addToResourcePolicy(new iam.PolicyStatement({
    sid: "DenySnapshotUploadsWithPublicAcl",
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ["s3:PutObject", "s3:PutObjectAcl"],
    resources: [snapshotBucket.arnForObjects("exports/*")],
    conditions: {
      StringEquals: {
        "s3:x-amz-acl": [
          "public-read",
          "public-read-write",
          "authenticated-read",
        ],
      },
    },
  }));

  const exporterRole = new iam.Role(stack, "StagingSnapshotExporterRole", {
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    description: "Read-only staging snapshot exporter task role for Share-to-Grow reconciliation artifacts.",
  });
  exporterRole.addToPolicy(new iam.PolicyStatement({
    sid: "WriteRunScopedEncryptedArtifacts",
    effect: iam.Effect.ALLOW,
    actions: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListBucket"],
    resources: [
      snapshotBucket.bucketArn,
      snapshotBucket.arnForObjects("exports/*"),
    ],
  }));
  exporterRole.addToPolicy(new iam.PolicyStatement({
    sid: "EncryptSnapshotArtifactsWithDedicatedKey",
    effect: iam.Effect.ALLOW,
    actions: ["kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"],
    resources: [snapshotKey.keyArn],
  }));

  const launchBrokerExecutionRole = new iam.Role(stack, "SnapshotLaunchBrokerExecutionRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    description: "Execution role for staging snapshot launch broker.",
  });
  launchBrokerExecutionRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
  );
  launchBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadAndClaimRunAuthorization",
    effect: iam.Effect.ALLOW,
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: [snapshotAuthorizationTable.tableArn],
  }));
  launchBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "RunApprovedStagingSnapshotTaskOnly",
    effect: iam.Effect.ALLOW,
    actions: ["ecs:RunTask"],
    resources: [approvedTaskDefinitionArn.valueAsString],
    conditions: {
      ArnEquals: { "ecs:cluster": stagingClusterArn.valueAsString },
      Bool: { "ecs:enable-execute-command": "false" },
    },
  }));
  launchBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "DescribeApprovedTaskDefinitionOnly",
    effect: iam.Effect.ALLOW,
    actions: ["ecs:DescribeTaskDefinition"],
    resources: [approvedTaskDefinitionArn.valueAsString],
  }));
  launchBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "PassOnlySnapshotTaskRoles",
    effect: iam.Effect.ALLOW,
    actions: ["iam:PassRole"],
    resources: [exporterRole.roleArn, stagingTaskExecutionRoleArn.valueAsString],
    conditions: {
      StringEquals: { "iam:PassedToService": "ecs-tasks.amazonaws.com" },
    },
  }));

  const launchBrokerFn = new lambda.Function(stack, "SnapshotLaunchBrokerFunction", {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: "launch-broker-lambda.handler",
    code: lambda.Code.fromAsset(brokerAssetPath),
    timeout: cdk.Duration.seconds(30),
    role: launchBrokerExecutionRole,
    environment: {
      EXPECTED_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      AUTHORIZATION_TABLE_NAME: snapshotAuthorizationTable.tableName,
      STAGING_CLUSTER_ARN: stagingClusterArn.valueAsString,
      APPROVED_TASK_DEFINITION_ARN: approvedTaskDefinitionArn.valueAsString,
      TASK_CONTAINER_NAME: "StagingSnapshotExport",
      STAGING_SUBNETS: cdk.Fn.join(",", stagingSubnets.valueAsList),
      STAGING_SECURITY_GROUPS: cdk.Fn.join(",", stagingSecurityGroups.valueAsList),
      LAUNCH_CLAIM_TTL_SECONDS: "180",
    },
  });
  const launchBrokerUrl = launchBrokerFn.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.AWS_IAM,
  });

  const readerBrokerExecutionRole = new iam.Role(stack, "SnapshotReaderBrokerExecutionRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    description: "Execution role for run-scoped snapshot reader session broker.",
  });
  readerBrokerExecutionRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
  );
  readerBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadRunAuthorization",
    effect: iam.Effect.ALLOW,
    actions: ["dynamodb:GetItem"],
    resources: [snapshotAuthorizationTable.tableArn],
  }));

  const readerRole = new iam.Role(stack, "StagingSnapshotReaderRole", {
    assumedBy: new iam.ArnPrincipal(readerBrokerExecutionRole.roleArn).withConditions({
      StringLike: {
        "aws:RequestTag/reconciliation-run-id": "s2g-run-*",
      },
      "ForAllValues:StringEquals": {
        "aws:TagKeys": ["reconciliation-run-id"],
      },
    }),
    description: "Read-only role for retrieving run-scoped encrypted snapshot artifacts.",
  });
  readerRole.assumeRolePolicy.addStatements(new iam.PolicyStatement({
    sid: "AllowSessionTaggingForRunScopedRead",
    effect: iam.Effect.ALLOW,
    principals: [new iam.ArnPrincipal(readerBrokerExecutionRole.roleArn)],
    actions: ["sts:TagSession"],
    conditions: {
      StringLike: {
        "aws:RequestTag/reconciliation-run-id": "s2g-run-*",
      },
      "ForAllValues:StringEquals": {
        "aws:TagKeys": ["reconciliation-run-id"],
      },
    },
  }));
  readerRole.addToPolicy(new iam.PolicyStatement({
    sid: "DenyMissingRunIdSessionTag",
    effect: iam.Effect.DENY,
    actions: ["s3:GetObject", "s3:ListBucket", "kms:Decrypt"],
    resources: ["*"],
    conditions: {
      Null: {
        "aws:PrincipalTag/reconciliation-run-id": "true",
      },
    },
  }));
  readerRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadRunScopedArtifactsOnly",
    effect: iam.Effect.ALLOW,
    actions: ["s3:GetObject"],
    resources: [snapshotBucket.arnForObjects("exports/${aws:PrincipalTag/reconciliation-run-id}/*")],
  }));
  readerRole.addToPolicy(new iam.PolicyStatement({
    sid: "ListRunScopedArtifactsOnly",
    effect: iam.Effect.ALLOW,
    actions: ["s3:ListBucket"],
    resources: [snapshotBucket.bucketArn],
    conditions: {
      StringLike: {
        "s3:prefix": ["exports/${aws:PrincipalTag/reconciliation-run-id}/*"],
      },
    },
  }));
  readerRole.addToPolicy(new iam.PolicyStatement({
    sid: "DecryptSnapshotArtifacts",
    effect: iam.Effect.ALLOW,
    actions: ["kms:Decrypt", "kms:DescribeKey"],
    resources: [snapshotKey.keyArn],
    conditions: {
      StringLike: {
        "kms:EncryptionContext:aws:s3:arn":
          `${snapshotBucket.bucketArn}/exports/\${aws:PrincipalTag/reconciliation-run-id}/*`,
      },
    },
  }));
  readerBrokerExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "AssumeReaderRoleWithRunTagOnly",
    effect: iam.Effect.ALLOW,
    actions: ["sts:AssumeRole", "sts:TagSession"],
    resources: [readerRole.roleArn],
    conditions: {
      StringLike: {
        "aws:RequestTag/reconciliation-run-id": "s2g-run-*",
      },
      "ForAllValues:StringEquals": {
        "aws:TagKeys": ["reconciliation-run-id"],
      },
    },
  }));

  const readerBrokerFn = new lambda.Function(stack, "SnapshotReaderSessionBrokerFunction", {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: "reader-session-broker-lambda.handler",
    code: lambda.Code.fromAsset(brokerAssetPath),
    timeout: cdk.Duration.seconds(30),
    role: readerBrokerExecutionRole,
    environment: {
      EXPECTED_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      AUTHORIZATION_TABLE_NAME: snapshotAuthorizationTable.tableName,
      READER_ROLE_ARN: readerRole.roleArn,
    },
  });
  const readerBrokerUrl = readerBrokerFn.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.AWS_IAM,
  });

  const operatorRole = new iam.Role(stack, "StagingSnapshotOperatorRole", {
    assumedBy: new iam.ArnPrincipal(operatorPrincipalArn.valueAsString),
    description: "Restricted operator role for invoking snapshot broker APIs only.",
  });
  operatorRole.addToPolicy(new iam.PolicyStatement({
    sid: "InvokeSnapshotLaunchBrokerOnly",
    effect: iam.Effect.ALLOW,
    actions: ["lambda:InvokeFunctionUrl"],
    resources: [launchBrokerFn.functionArn],
    conditions: {
      StringEquals: {
        "lambda:FunctionUrlAuthType": "AWS_IAM",
      },
    },
  }));
  operatorRole.addToPolicy(new iam.PolicyStatement({
    sid: "InvokeSnapshotReaderBrokerOnly",
    effect: iam.Effect.ALLOW,
    actions: ["lambda:InvokeFunctionUrl"],
    resources: [readerBrokerFn.functionArn],
    conditions: {
      StringEquals: {
        "lambda:FunctionUrlAuthType": "AWS_IAM",
      },
    },
  }));

  new cdk.CfnOutput(stack, "SnapshotArtifactBucketName", { value: snapshotBucket.bucketName });
  new cdk.CfnOutput(stack, "SnapshotArtifactKmsKeyArn", { value: snapshotKey.keyArn });
  new cdk.CfnOutput(stack, "SnapshotExporterRoleArn", { value: exporterRole.roleArn });
  new cdk.CfnOutput(stack, "SnapshotReaderRoleArn", { value: readerRole.roleArn });
  new cdk.CfnOutput(stack, "SnapshotOperatorRoleArn", { value: operatorRole.roleArn });
  new cdk.CfnOutput(stack, "SnapshotAuthorizationTableName", { value: snapshotAuthorizationTable.tableName });
  new cdk.CfnOutput(stack, "SnapshotLaunchBrokerUrl", { value: launchBrokerUrl.url });
  new cdk.CfnOutput(stack, "SnapshotReaderBrokerUrl", { value: readerBrokerUrl.url });

  return stack;
}
