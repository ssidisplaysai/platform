import cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER,
  S2G_DB_ADMIN_DIAGNOSTIC_FAMILY,
  S2G_DB_ADMIN_DIAGNOSTIC_IMAGE_DIGEST,
} from "../../s2g-db-admin-diagnostic-contract.mjs";

const brokerAssetPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "broker");

export function createStagingS2gDbAdminLauncherStack(app, id = "GenesisStagingS2gDbAdminDiagnosticLauncherStack", props = {}) {
  const stack = new cdk.Stack(app, id, props);

  const operatorPrincipalArn = new cdk.CfnParameter(stack, "OperatorPrincipalArn", {
    type: "String",
    description: "IAM principal ARN allowed to assume the staging DB admin diagnostic operator role.",
  });
  const operatorAssumerPrincipalArn = new cdk.CfnParameter(stack, "OperatorAssumerPrincipalArn", {
    type: "String",
    default: "",
    description: "Restricted IAM principal ARN allowed to assume the staging DB admin diagnostic operator role. Leave empty to retain OperatorPrincipalArn trust.",
  });
  const stagingClusterArn = new cdk.CfnParameter(stack, "StagingClusterArn", {
    type: "String",
    default: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
  });
  const approvedDiagnosticTaskDefinitionArn = new cdk.CfnParameter(stack, "ApprovedDiagnosticTaskDefinitionArn", {
    type: "String",
    default: "",
    allowedPattern: `(^$)|(^arn:aws:ecs:us-west-2:452630323448:task-definition/${S2G_DB_ADMIN_DIAGNOSTIC_FAMILY}:[1-9][0-9]*$)`,
    description: "Exact approved diagnostic task definition ARN including revision.",
  });
  const approvedDiagnosticImageDigest = new cdk.CfnParameter(stack, "ApprovedDiagnosticImageDigest", {
    type: "String",
    default: S2G_DB_ADMIN_DIAGNOSTIC_IMAGE_DIGEST,
    allowedPattern: "^sha256:[a-f0-9]{64}$",
    description: "Exact approved immutable image digest for the diagnostic task container.",
  });
  const launcherActivationState = new cdk.CfnParameter(stack, "LauncherActivationState", {
    type: "String",
    default: "DISABLED",
    allowedValues: ["DISABLED", "ENABLED"],
    description: "Two-stage activation guard for DB admin diagnostic launcher.",
  });
  const stagingSubnets = new cdk.CfnParameter(stack, "StagingSubnets", {
    type: "CommaDelimitedList",
    default: "subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c",
  });
  const stagingSecurityGroups = new cdk.CfnParameter(stack, "StagingSecurityGroups", {
    type: "CommaDelimitedList",
    default: "sg-0687242229bc3a80e",
  });
  const diagnosticExecutionRoleArn = new cdk.CfnParameter(stack, "DiagnosticExecutionRoleArn", {
    type: "String",
    default: "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-execution-role",
  });
  const diagnosticTaskRoleArn = new cdk.CfnParameter(stack, "DiagnosticTaskRoleArn", {
    type: "String",
    default: "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-task-role",
  });
  const approvedAdminSecretArn = new cdk.CfnParameter(stack, "ApprovedAdminSecretArn", {
    type: "String",
    noEcho: true,
    default: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
    allowedPattern: "^arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-[A-Za-z0-9-]+$",
  });
  const expectedDatabaseHost = new cdk.CfnParameter(stack, "ExpectedDatabaseHost", {
    type: "String",
    default: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
  });
  const expectedDatabaseName = new cdk.CfnParameter(stack, "ExpectedDatabaseName", {
    type: "String",
    default: "genesis_staging",
  });
  const launcherTable = new dynamodb.Table(stack, "DbAdminDiagnosticLaunchTable", {
    tableName: "genesis-staging-s2g-db-admin-diagnostic-launches",
    partitionKey: {
      name: "runId",
      type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    timeToLiveAttribute: "claimExpiresAtEpoch",
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  const launcherExecutionRole = new iam.Role(stack, "DbAdminDiagnosticLauncherExecutionRole", {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    description: "Execution role for staging DB admin diagnostic launcher.",
  });
  launcherExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
  launcherExecutionRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadAndClaimDiagnosticLaunch",
    effect: iam.Effect.ALLOW,
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
    resources: [launcherTable.tableArn],
  }));

  const launcherEnabledCondition = new cdk.CfnCondition(stack, "LauncherEnabledCondition", {
    expression: cdk.Fn.conditionEquals(launcherActivationState.valueAsString, "ENABLED"),
  });
  const operatorAssumerPrincipalProvidedCondition = new cdk.CfnCondition(stack, "OperatorAssumerPrincipalProvidedCondition", {
    expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(operatorAssumerPrincipalArn.valueAsString, "")),
  });
  new cdk.CfnRule(stack, "OperatorAssumerPrincipalMustNotBeAdministratorAccess", {
    assertions: [
      {
        assert: cdk.Fn.conditionOr(
          cdk.Fn.conditionEquals(operatorAssumerPrincipalArn.valueAsString, ""),
          cdk.Fn.conditionNot(cdk.Fn.conditionContains([
            operatorAssumerPrincipalArn.valueAsString,
          ], "AWSReservedSSO_AdministratorAccess_")),
        ),
        assertDescription: "OperatorAssumerPrincipalArn must not be the AWSReservedSSO AdministratorAccess role.",
      },
    ],
  });
  const operatorTrustPrincipalArn = cdk.Token.asString(cdk.Fn.conditionIf(
    operatorAssumerPrincipalProvidedCondition.logicalId,
    operatorAssumerPrincipalArn.valueAsString,
    operatorPrincipalArn.valueAsString,
  ));
  const approvedNetworkIdentity = cdk.Fn.join("|", [
    stagingClusterArn.valueAsString,
    cdk.Fn.join(",", stagingSubnets.valueAsList),
    cdk.Fn.join(",", stagingSecurityGroups.valueAsList),
  ]);

  const launcherEnabledPolicy = new iam.Policy(stack, "DbAdminDiagnosticLauncherEnabledPolicy", {
    roles: [launcherExecutionRole],
    statements: [
      new iam.PolicyStatement({
        sid: "RunApprovedDiagnosticTaskOnly",
        effect: iam.Effect.ALLOW,
        actions: ["ecs:RunTask"],
        resources: [approvedDiagnosticTaskDefinitionArn.valueAsString],
        conditions: {
          ArnEquals: { "ecs:cluster": stagingClusterArn.valueAsString },
          Bool: { "ecs:enable-execute-command": "false" },
        },
      }),
      new iam.PolicyStatement({
        sid: "DescribeApprovedDiagnosticTaskOnly",
        effect: iam.Effect.ALLOW,
        actions: ["ecs:DescribeTaskDefinition"],
        resources: [approvedDiagnosticTaskDefinitionArn.valueAsString],
      }),
      new iam.PolicyStatement({
        sid: "PassOnlyDedicatedDiagnosticTaskRoles",
        effect: iam.Effect.ALLOW,
        actions: ["iam:PassRole"],
        resources: [diagnosticExecutionRoleArn.valueAsString, diagnosticTaskRoleArn.valueAsString],
        conditions: {
          StringEquals: { "iam:PassedToService": "ecs-tasks.amazonaws.com" },
        },
      }),
    ],
  });
  launcherEnabledPolicy.node.defaultChild.cfnOptions.condition = launcherEnabledCondition;

  const launcherFunction = new lambda.Function(stack, "DbAdminDiagnosticLauncherFunction", {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: "diagnostic-launcher-lambda.handler",
    code: lambda.Code.fromAsset(brokerAssetPath),
    timeout: cdk.Duration.seconds(30),
    role: launcherExecutionRole,
    environment: {
      EXPECTED_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      EXPECTED_REGION: cdk.Aws.REGION,
      STAGING_CLUSTER_ARN: stagingClusterArn.valueAsString,
      APPROVED_DIAGNOSTIC_TASK_DEFINITION_ARN: approvedDiagnosticTaskDefinitionArn.valueAsString,
      APPROVED_DIAGNOSTIC_IMAGE_DIGEST: approvedDiagnosticImageDigest.valueAsString,
      TASK_CONTAINER_NAME: S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER,
      STAGING_SUBNETS: cdk.Fn.join(",", stagingSubnets.valueAsList),
      STAGING_SECURITY_GROUPS: cdk.Fn.join(",", stagingSecurityGroups.valueAsList),
      APPROVED_NETWORK_IDENTITY: approvedNetworkIdentity,
      EXPECTED_DATABASE_HOST: expectedDatabaseHost.valueAsString,
      EXPECTED_DATABASE_NAME: expectedDatabaseName.valueAsString,
      APPROVED_ADMIN_SECRET_ARN: approvedAdminSecretArn.valueAsString,
      LAUNCH_TABLE_NAME: launcherTable.tableName,
      LAUNCH_AUTH_SCHEMA_VERSION: "2026-10-13",
      LAUNCH_AUTH_PURPOSE: "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC",
      LAUNCH_AUTH_MAX_ATTEMPTS: "1",
      LAUNCHER_ACTIVATION_STATE: launcherActivationState.valueAsString,
    },
  });
  const launcherUrl = launcherFunction.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.AWS_IAM,
  });

  const operatorRole = new iam.Role(stack, "StagingS2gDbAdminDiagnosticOperatorRole", {
    assumedBy: new iam.ArnPrincipal(operatorTrustPrincipalArn),
    description: "Restricted role for invoking the S2G DB admin diagnostic launcher only.",
  });
  const operatorEnabledPolicy = new iam.Policy(stack, "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy", {
    roles: [operatorRole],
    statements: [
      new iam.PolicyStatement({
        sid: "InvokeDbAdminDiagnosticLauncherOnly",
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunctionUrl"],
        resources: [launcherFunction.functionArn],
        conditions: {
          StringEquals: {
            "lambda:FunctionUrlAuthType": "AWS_IAM",
          },
        },
      }),
      new iam.PolicyStatement({
        sid: "InvokeDbAdminDiagnosticLauncherFunctionOnlyViaUrl",
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [launcherFunction.functionArn],
        conditions: {
          Bool: {
            "lambda:InvokedViaFunctionUrl": "true",
          },
        },
      }),
    ],
  });
  operatorEnabledPolicy.node.defaultChild.cfnOptions.condition = launcherEnabledCondition;

  new cdk.CfnOutput(stack, "DbAdminDiagnosticLauncherOperatorRoleArn", { value: operatorRole.roleArn });
  new cdk.CfnOutput(stack, "DbAdminDiagnosticLauncherUrl", { value: launcherUrl.url });
  new cdk.CfnOutput(stack, "DbAdminDiagnosticLaunchTableName", { value: launcherTable.tableName });

  return stack;
}
