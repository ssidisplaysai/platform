import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const approvedActions = new Set([
  "ec2:DescribeRouteTables",
  "ec2:DescribeSecurityGroups",
  "ec2:DescribeSubnets",
  "iam:CreateServiceLinkedRole",
  "kms:DescribeKey",
  "rds:AddTagsToResource",
  "rds:CreateDBInstance",
  "rds:CreateDBSubnetGroup",
  "rds:DescribeDBInstances",
  "rds:DescribeDBSubnetGroups",
  "rds:ListTagsForResource",
  "secretsmanager:CreateSecret",
  "secretsmanager:DescribeSecret",
  "secretsmanager:TagResource",
]);

const requiredStatements = {
  PostgresNetworkDescribe: {
    Action: ["ec2:DescribeRouteTables", "ec2:DescribeSecurityGroups", "ec2:DescribeSubnets"],
    Resource: "*",
  },
  RdsPostgresDescribe: {
    Action: ["rds:DescribeDBInstances", "rds:DescribeDBSubnetGroups"],
    Resource: "*",
  },
  RdsCreateStagingPostgres: {
    Action: "rds:CreateDBInstance",
    Resource: "arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres",
    Condition: {
      StringEquals: {
        "aws:RequestTag/Environment": "staging",
        "rds:DatabaseClass": "db.t4g.micro",
        "rds:DatabaseEngine": "postgres",
      },
    },
  },
  RdsUseStagingPostgresSubnetGroup: {
    Action: "rds:CreateDBInstance",
    Resource: "arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres",
  },
  RdsUseDefaultPostgres16Groups: {
    Action: "rds:CreateDBInstance",
    Resource: [
      "arn:aws:rds:us-west-2:452630323448:pg:default.postgres16",
      "arn:aws:rds:us-west-2:452630323448:og:default:postgres-16",
    ],
  },
  RdsCreateStagingPostgresSubnetGroup: {
    Action: "rds:CreateDBSubnetGroup",
    Resource: "arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres",
    Condition: { StringEquals: { "aws:RequestTag/Environment": "staging" } },
  },
  RdsTagStagingPostgresOnCreate: {
    Action: "rds:AddTagsToResource",
    Resource: [
      "arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres",
      "arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres",
    ],
    Condition: { StringEquals: { "aws:RequestTag/Environment": "staging" } },
  },
  RdsListStagingPostgresTags: {
    Action: "rds:ListTagsForResource",
    Resource: [
      "arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres",
      "arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres",
    ],
  },
  CreateStagingPostgresSecret: {
    Action: "secretsmanager:CreateSecret",
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*",
    Condition: { StringEquals: { "aws:RequestTag/Environment": "staging" } },
  },
  TagStagingPostgresSecret: {
    Action: "secretsmanager:TagResource",
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*",
    Condition: { StringEquals: { "aws:RequestTag/Environment": "staging" } },
  },
  CreateRdsManagedMasterSecret: {
    Action: "secretsmanager:CreateSecret",
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-*",
  },
  TagRdsManagedMasterSecret: {
    Action: "secretsmanager:TagResource",
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-*",
  },
  DescribeStagingPostgresSecret: {
    Action: "secretsmanager:DescribeSecret",
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-*",
  },
  CreateRdsServiceLinkedRole: {
    Action: "iam:CreateServiceLinkedRole",
    Resource: "arn:aws:iam::452630323448:role/aws-service-role/rds.amazonaws.com/AWSServiceRoleForRDS",
    Condition: { StringEquals: { "iam:AWSServiceName": "rds.amazonaws.com" } },
  },
  DescribeSecretsManagerDefaultKeyForRdsManagedMasterPassword: {
    Action: "kms:DescribeKey",
    Resource: "arn:aws:kms:us-west-2:452630323448:key/1dc17669-f1bc-418f-b266-ee8f3612d30a",
  },
};

function fail(message) {
  throw new Error(message);
}

export function validateStagingPostgresPolicy(document, source = "") {
  if (Buffer.byteLength(source.replace(/\s/g, "")) >= 6144) {
    fail("policy exceeds the customer-managed policy size limit");
  }

  if (!Array.isArray(document.Statement) || document.Statement.length !== Object.keys(requiredStatements).length) {
    fail("staging PostgreSQL policy has missing or unexpected statements");
  }

  const actions = [];
  const statementsBySid = new Map();
  for (const statement of document.Statement) {
    if (statement.Effect !== "Allow") {
      fail("staging PostgreSQL policy contains a non-Allow statement");
    }
    const statementActions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    actions.push(...statementActions);
    statementsBySid.set(statement.Sid, statement);
  }

  if (
    actions.some((action) => !approvedActions.has(action)) ||
    [...approvedActions].some((action) => !actions.includes(action))
  ) {
    fail("staging PostgreSQL policy has missing or unapproved actions");
  }
  if (actions.some((action) => action.includes("*"))) {
    fail("staging PostgreSQL policy contains a wildcard action");
  }
  if (actions.includes("secretsmanager:GetSecretValue") || actions.includes("iam:PassRole")) {
    fail("staging PostgreSQL policy contains a prohibited action");
  }

  for (const [sid, expected] of Object.entries(requiredStatements)) {
    const statement = statementsBySid.get(sid);
    if (!statement) fail(`missing or unsafe scope in staging PostgreSQL statement ${sid}`);
    const expectedStatement = { Sid: sid, Effect: "Allow", ...expected };
    if (!isDeepStrictEqual(statement, expectedStatement)) {
      fail(`missing or unsafe scope in staging PostgreSQL statement ${sid}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("policy path is required");
    const source = await readFile(filePath, "utf8");
    validateStagingPostgresPolicy(JSON.parse(source.replace(/^\uFEFF/, "")), source);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "staging PostgreSQL policy validation failed");
    process.exitCode = 1;
  }
}
