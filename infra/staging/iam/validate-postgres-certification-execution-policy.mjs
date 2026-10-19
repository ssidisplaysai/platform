import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const EXPECTED_POLICY = {
  Version: "2012-10-17",
  Statement: [{
    Sid: "ReadExactPostgresCertificationSecrets",
    Effect: "Allow",
    Action: "secretsmanager:GetSecretValue",
    Resource: [
      "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/postgres-JFaw1C",
      "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
    ],
  }],
};

export function validatePostgresCertificationExecutionPolicy(document) {
  if (!isDeepStrictEqual(document, EXPECTED_POLICY)) {
    throw new Error("PostgreSQL certification execution policy must allow only the two approved exact secret ARNs.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("policy path is required");
    const source = await readFile(filePath, "utf8");
    validatePostgresCertificationExecutionPolicy(JSON.parse(source.replace(/^\uFEFF/, "")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "certification execution policy validation failed");
    process.exitCode = 1;
  }
}
