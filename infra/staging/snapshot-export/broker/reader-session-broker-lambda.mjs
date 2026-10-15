import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { issueReaderSession, mapReaderBrokerFailureCode } from "./reader-session-broker-core.mjs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sts = new STSClient({});

const config = Object.freeze({
  brokerActivationState: process.env.BROKER_ACTIVATION_STATE ?? "DISABLED",
  expectedAccountId: process.env.EXPECTED_ACCOUNT_ID ?? "",
  readerRoleArn: process.env.READER_ROLE_ARN ?? "",
  authorizationTableName: process.env.AUTHORIZATION_TABLE_NAME ?? "",
});

const deps = {
  nowEpochSeconds: () => Math.floor(Date.now() / 1000),
  async getRunAuthorization(runId) {
    const response = await ddb.send(new GetCommand({
      TableName: config.authorizationTableName,
      Key: { runId },
      ConsistentRead: true,
    }));
    return response.Item ?? null;
  },
  async assumeRole({ roleArn, roleSessionName, durationSeconds, tags }) {
    return sts.send(new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: roleSessionName,
      DurationSeconds: durationSeconds,
      Tags: tags,
    }));
  },
};

export async function handler(event) {
  try {
    return await issueReaderSession(event, { config, deps });
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
      body: JSON.stringify({ outcome: "REJECTED", code: mapReaderBrokerFailureCode(error) }),
    };
  }
}
