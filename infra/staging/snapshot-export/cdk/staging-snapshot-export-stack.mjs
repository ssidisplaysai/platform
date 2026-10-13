import cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";

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
  const readerPrincipalArn = new cdk.CfnParameter(stack, "ReaderPrincipalArn", {
    type: "String",
    description: "IAM principal ARN allowed to assume the snapshot reader role.",
  });
  const stagingClusterArn = new cdk.CfnParameter(stack, "StagingClusterArn", {
    type: "String",
    default: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
  });
  const stagingTaskExecutionRoleArn = new cdk.CfnParameter(stack, "StagingTaskExecutionRoleArn", {
    type: "String",
    default: "arn:aws:iam::452630323448:role/genesis-staging-execution-role",
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
    description: "Read-only staging snapshot exporter role for Share-to-Grow reconciliation artifacts.",
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

  const readerRole = new iam.Role(stack, "StagingSnapshotReaderRole", {
    assumedBy: new iam.ArnPrincipal(readerPrincipalArn.valueAsString),
    description: "Read-only role for retrieving run-scoped encrypted snapshot artifacts.",
  });
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
  }));

  const operatorRole = new iam.Role(stack, "StagingSnapshotOperatorRole", {
    assumedBy: new iam.ArnPrincipal(operatorPrincipalArn.valueAsString),
    description: "Restricted operator role for launching only approved staging snapshot export tasks.",
  });
  operatorRole.addToPolicy(new iam.PolicyStatement({
    sid: "RunApprovedStagingSnapshotTaskOnly",
    effect: iam.Effect.ALLOW,
    actions: ["ecs:RunTask"],
    resources: ["arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-snapshot-export:*"],
    conditions: {
      ArnEquals: { "ecs:cluster": stagingClusterArn.valueAsString },
    },
  }));
  operatorRole.addToPolicy(new iam.PolicyStatement({
    sid: "DescribeSnapshotTasks",
    effect: iam.Effect.ALLOW,
    actions: ["ecs:DescribeTasks"],
    resources: ["*"],
    conditions: {
      ArnEquals: { "ecs:cluster": stagingClusterArn.valueAsString },
    },
  }));
  operatorRole.addToPolicy(new iam.PolicyStatement({
    sid: "PassOnlyApprovedSnapshotTaskRoles",
    effect: iam.Effect.ALLOW,
    actions: ["iam:PassRole"],
    resources: [exporterRole.roleArn, stagingTaskExecutionRoleArn.valueAsString],
    conditions: {
      StringEquals: {
        "iam:PassedToService": "ecs-tasks.amazonaws.com",
      },
    },
  }));

  new cdk.CfnOutput(stack, "SnapshotArtifactBucketName", { value: snapshotBucket.bucketName });
  new cdk.CfnOutput(stack, "SnapshotArtifactKmsKeyArn", { value: snapshotKey.keyArn });
  new cdk.CfnOutput(stack, "SnapshotExporterRoleArn", { value: exporterRole.roleArn });
  new cdk.CfnOutput(stack, "SnapshotReaderRoleArn", { value: readerRole.roleArn });
  new cdk.CfnOutput(stack, "SnapshotOperatorRoleArn", { value: operatorRole.roleArn });

  return stack;
}

