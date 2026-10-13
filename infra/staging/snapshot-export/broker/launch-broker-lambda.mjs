import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ECSClient, DescribeTaskDefinitionCommand, RunTaskCommand } from "@aws-sdk/client-ecs";
import {
  GetCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { authorizeAndLaunchSnapshotExport, mapLaunchBrokerFailureCode } from "./launch-broker-core.mjs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ecs = new ECSClient({});

const config = Object.freeze({
  expectedAccountId: process.env.EXPECTED_ACCOUNT_ID ?? "",
  stagingClusterArn: process.env.STAGING_CLUSTER_ARN ?? "",
  approvedTaskDefinitionArn: process.env.APPROVED_TASK_DEFINITION_ARN ?? "",
  taskContainerName: process.env.TASK_CONTAINER_NAME ?? "StagingSnapshotExport",
  subnets: (process.env.STAGING_SUBNETS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  securityGroups: (process.env.STAGING_SECURITY_GROUPS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  authorizationTableName: process.env.AUTHORIZATION_TABLE_NAME ?? "",
});

const deps = {
  nowIso: () => new Date().toISOString(),
  async getRunAuthorization(runId) {
    const response = await ddb.send(new GetCommand({
      TableName: config.authorizationTableName,
      Key: { runId },
      ConsistentRead: true,
    }));
    return response.Item ?? null;
  },
  async claimRunLaunch({ runId, requestNonce, invokerArn, claimedAt }) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: config.authorizationTableName,
        Key: { runId },
        UpdateExpression: "SET claimNonce = :nonce, claimInvokerArn = :invokerArn, claimAt = :claimedAt",
        ExpressionAttributeValues: {
          ":nonce": requestNonce,
          ":invokerArn": invokerArn,
          ":claimedAt": claimedAt,
          ":approved": "APPROVED",
          ":launched": "LAUNCHED",
        },
        ConditionExpression:
          "attribute_exists(runId) AND (#status = :approved) AND (attribute_not_exists(launchState) OR launchState <> :launched)",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ReturnValues: "NONE",
      }));
      return { status: "CLAIMED" };
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") {
        const current = await this.getRunAuthorization(runId);
        return { status: "ALREADY_CLAIMED", launchTaskArn: current?.launchTaskArn ?? null };
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
  async recordRunLaunch({ runId, taskArn, launchedAt }) {
    await ddb.send(new UpdateCommand({
      TableName: config.authorizationTableName,
      Key: { runId },
      UpdateExpression: "SET launchState = :state, launchTaskArn = :taskArn, launchAt = :launchAt",
      ExpressionAttributeValues: {
        ":state": "LAUNCHED",
        ":taskArn": taskArn,
        ":launchAt": launchedAt,
      },
      ConditionExpression: "attribute_exists(runId)",
    }));
  },
};

export async function handler(event) {
  try {
    return await authorizeAndLaunchSnapshotExport(event, { config, deps });
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ outcome: "REJECTED", code: mapLaunchBrokerFailureCode(error) }),
    };
  }
}
