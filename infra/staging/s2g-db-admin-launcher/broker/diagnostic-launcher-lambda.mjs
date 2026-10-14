import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ECSClient, DescribeTaskDefinitionCommand, RunTaskCommand } from "@aws-sdk/client-ecs";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { authorizeAndLaunchDbAdminDiagnostic, mapDiagnosticLauncherFailureCode } from "./diagnostic-launcher-core.mjs";
import { S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER } from "../../s2g-db-admin-diagnostic-contract.mjs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ecs = new ECSClient({});

const config = Object.freeze({
  launcherActivationState: process.env.LAUNCHER_ACTIVATION_STATE ?? "DISABLED",
  expectedAccountId: process.env.EXPECTED_ACCOUNT_ID ?? "",
  expectedRegion: process.env.EXPECTED_REGION ?? "",
  stagingClusterArn: process.env.STAGING_CLUSTER_ARN ?? "",
  approvedDiagnosticTaskDefinitionArn: process.env.APPROVED_DIAGNOSTIC_TASK_DEFINITION_ARN ?? "",
  approvedDiagnosticImageDigest: process.env.APPROVED_DIAGNOSTIC_IMAGE_DIGEST ?? "",
  taskContainerName: process.env.TASK_CONTAINER_NAME ?? S2G_DB_ADMIN_DIAGNOSTIC_CONTAINER,
  subnets: (process.env.STAGING_SUBNETS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  securityGroups: (process.env.STAGING_SECURITY_GROUPS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  approvedNetworkIdentity: process.env.APPROVED_NETWORK_IDENTITY ?? "",
  expectedDatabaseHost: process.env.EXPECTED_DATABASE_HOST ?? "",
  expectedDatabaseName: process.env.EXPECTED_DATABASE_NAME ?? "",
  approvedAdminSecretArn: process.env.APPROVED_ADMIN_SECRET_ARN ?? "",
  launchTableName: process.env.LAUNCH_TABLE_NAME ?? "",
  authorizationSchemaVersion: process.env.LAUNCH_AUTH_SCHEMA_VERSION ?? "",
  authorizationPurpose: process.env.LAUNCH_AUTH_PURPOSE ?? "",
  maxLaunchAttempts: Number.parseInt(process.env.LAUNCH_AUTH_MAX_ATTEMPTS ?? "1", 10),
});

const deps = {
  nowIso: () => new Date().toISOString(),
  nowEpochSeconds: () => Math.floor(Date.now() / 1000),
  async getLaunchRecord(runId) {
    const response = await ddb.send(new GetCommand({
      TableName: config.launchTableName,
      Key: { runId },
      ConsistentRead: true,
    }));
    return response.Item ?? null;
  },
  async claimLaunch({ runId, invokerArn, nowEpochSeconds, claimedAt }) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: config.launchTableName,
        Key: { runId },
        UpdateExpression:
          "SET launchState = :claimed, claimInvokerArn = :invokerArn, claimAt = :claimedAt, launchAttempts = if_not_exists(launchAttempts, :zero) + :one",
        ExpressionAttributeValues: {
          ":claimed": "CLAIMED",
          ":invokerArn": invokerArn,
          ":claimedAt": claimedAt,
          ":authorized": "AUTHORIZED",
          ":schemaVersion": config.authorizationSchemaVersion,
          ":purpose": config.authorizationPurpose,
          ":taskArn": config.approvedDiagnosticTaskDefinitionArn,
          ":clusterArn": config.stagingClusterArn,
          ":imageDigest": config.approvedDiagnosticImageDigest,
          ":networkIdentity": config.approvedNetworkIdentity,
          ":maxLaunchAttempts": config.maxLaunchAttempts,
          ":expectedAccountId": config.expectedAccountId,
          ":expectedRegion": config.expectedRegion,
          ":zero": 0,
          ":one": 1,
          ":nowEpoch": nowEpochSeconds,
        },
        ConditionExpression:
          "attribute_exists(runId)"
          + " AND launchState = :authorized"
          + " AND schemaVersion = :schemaVersion"
          + " AND purpose = :purpose"
          + " AND approvedDiagnosticTaskDefinitionArn = :taskArn"
          + " AND approvedClusterArn = :clusterArn"
          + " AND approvedDiagnosticImageDigest = :imageDigest"
          + " AND approvedNetworkIdentity = :networkIdentity"
          + " AND authorizedOperatorArn = :invokerArn"
          + " AND maxLaunchAttempts = :maxLaunchAttempts"
          + " AND expectedAccountId = :expectedAccountId"
          + " AND expectedRegion = :expectedRegion"
          + " AND expiresAtEpoch > :nowEpoch"
          + " AND (attribute_not_exists(launchAttempts) OR launchAttempts < maxLaunchAttempts)",
        ReturnValues: "NONE",
      }));
      return { status: "CLAIMED" };
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") {
        const current = await this.getLaunchRecord(runId);
        if (!current) return { status: "AUTHORIZATION_MISSING" };
        if (current?.launchState === "LAUNCHED") {
          return { status: "ALREADY_LAUNCHED", launchTaskArn: current.launchTaskArn ?? null };
        }
        if (current?.launchState === "AUTHORIZED" && Number.isInteger(current?.expiresAtEpoch) && current.expiresAtEpoch <= nowEpochSeconds) {
          return { status: "AUTHORIZATION_EXPIRED" };
        }
        if (current?.launchState && current.launchState !== "AUTHORIZED") {
          return { status: "ALREADY_CONSUMED" };
        }
        return { status: "AUTHORIZATION_CONTRACT_MISMATCH" };
      }
      throw error;
    }
  },
  async describeTaskDefinition(taskDefinitionArn) {
    return ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: taskDefinitionArn }));
  },
  async runTask(input) {
    return ecs.send(new RunTaskCommand(input));
  },
  async recordLaunch({ runId, taskArn, launchedAt, operatorArn }) {
    await ddb.send(new UpdateCommand({
      TableName: config.launchTableName,
      Key: { runId },
      UpdateExpression:
        "SET launchState = :state, launchTaskArn = :taskArn, launchAt = :launchAt, operatorArn = :operatorArn",
      ExpressionAttributeValues: {
        ":state": "LAUNCHED",
        ":taskArn": taskArn,
        ":launchAt": launchedAt,
        ":operatorArn": operatorArn,
        ":claimedState": "CLAIMED",
      },
      ConditionExpression: "attribute_exists(runId) AND launchState = :claimedState",
    }));
  },
  async recordLaunchFailure({ runId, attemptedAt, operatorArn, failureCode }) {
    await ddb.send(new UpdateCommand({
      TableName: config.launchTableName,
      Key: { runId },
      UpdateExpression:
        "SET launchState = :state, launchAt = :launchAt, operatorArn = :operatorArn, launchFailureCode = :failureCode",
      ExpressionAttributeValues: {
        ":state": "LAUNCH_FAILED",
        ":launchAt": attemptedAt,
        ":operatorArn": operatorArn,
        ":failureCode": failureCode,
        ":claimedState": "CLAIMED",
      },
      ConditionExpression: "attribute_exists(runId) AND launchState = :claimedState",
    }));
  },
  async recordLaunchOutcomeUnknown({ runId, attemptedAt, operatorArn, failureCode }) {
    await ddb.send(new UpdateCommand({
      TableName: config.launchTableName,
      Key: { runId },
      UpdateExpression:
        "SET launchState = :state, launchAt = :launchAt, operatorArn = :operatorArn, launchFailureCode = :failureCode",
      ExpressionAttributeValues: {
        ":state": "OUTCOME_UNKNOWN",
        ":launchAt": attemptedAt,
        ":operatorArn": operatorArn,
        ":failureCode": failureCode,
        ":claimedState": "CLAIMED",
      },
      ConditionExpression: "attribute_exists(runId) AND launchState = :claimedState",
    }));
  },
};

export async function handler(event) {
  try {
    return await authorizeAndLaunchDbAdminDiagnostic(event, { config, deps });
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        outcome: "REJECTED",
        code: mapDiagnosticLauncherFailureCode(error),
      }),
    };
  }
}
