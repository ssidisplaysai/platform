import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const launchHandlerModulePath = resolve(
  import.meta.dirname,
  "../snapshot-export/broker/launch-broker-lambda.mjs",
);
const readerHandlerModulePath = resolve(
  import.meta.dirname,
  "../snapshot-export/broker/reader-session-broker-lambda.mjs",
);

function withEnv(pairs, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(pairs)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("launch broker lambda handler rejects authorized request while disabled", async () => {
  await withEnv(
    {
      BROKER_ACTIVATION_STATE: "DISABLED",
      EXPECTED_ACCOUNT_ID: "452630323448",
    },
    async () => {
      const moduleUrl = `${pathToFileURL(launchHandlerModulePath).href}?cacheBust=${Date.now()}`;
      const { handler } = await import(moduleUrl);
      const response = await handler({
        requestContext: {
          authorizer: {
            iam: {
              userArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
            },
          },
        },
        body: JSON.stringify({ runId: "s2g-run-abc123" }),
      });
      const payload = JSON.parse(response.body);
      assert.equal(response.statusCode, 400);
      assert.equal(payload.code, "BROKER_DISABLED");
    },
  );
});

test("reader broker lambda handler rejects authorized request while disabled", async () => {
  await withEnv(
    {
      BROKER_ACTIVATION_STATE: "DISABLED",
      EXPECTED_ACCOUNT_ID: "452630323448",
      READER_ROLE_ARN: "arn:aws:iam::452630323448:role/StagingSnapshotReaderRole",
    },
    async () => {
      const moduleUrl = `${pathToFileURL(readerHandlerModulePath).href}?cacheBust=${Date.now()}`;
      const { handler } = await import(moduleUrl);
      const response = await handler({
        requestContext: {
          authorizer: {
            iam: {
              userArn: "arn:aws:sts::452630323448:assumed-role/SnapshotOperator/rober",
            },
          },
        },
        body: JSON.stringify({ runId: "s2g-run-abc123" }),
      });
      const payload = JSON.parse(response.body);
      assert.equal(response.statusCode, 400);
      assert.equal(payload.code, "READER_BROKER_DISABLED");
      assert.equal(response.headers["Cache-Control"], "no-store");
    },
  );
});
