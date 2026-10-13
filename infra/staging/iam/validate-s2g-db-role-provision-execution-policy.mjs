import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const EXPECTED_POLICY = {
  Version: "2012-10-17",
  Statement: [{
    Sid: "ReadOnlyStagingRdsAdminSecret",
    Effect: "Allow",
    Action: [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ],
    Resource: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
  }],
};

export function validateS2gDbRoleProvisionExecutionPolicy(document) {
  if (!isDeepStrictEqual(document, EXPECTED_POLICY)) {
    throw new Error("S2G DB role provision execution policy must allow only read access to the exact staging RDS admin secret.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("policy path is required");
    const source = await readFile(filePath, "utf8");
    validateS2gDbRoleProvisionExecutionPolicy(JSON.parse(source.replace(/^\uFEFF/, "")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "s2g db role provision policy validation failed");
    process.exitCode = 1;
  }
}
