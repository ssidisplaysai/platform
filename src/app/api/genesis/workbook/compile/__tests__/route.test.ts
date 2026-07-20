import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { POST } from "../route";

const originalEnvironment = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnvironment };

  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Workbook compile runtime route", () => {
  it("rejects invalid bearer token", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "genesis-workbook-route-"));
    temporaryDirectories.push(artifactRoot);

    process.env.GENESIS_RUNTIME_API_KEY = "expected-secret";
    process.env.GENESIS_ARTIFACT_ROOT = artifactRoot;

    const response = await POST(
      new Request("http://localhost/api/genesis/workbook/compile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({
          runId: "runtime-route-unauthorized",
          workbook: {
            spreadsheetId: "sheet-123",
            properties: { title: "Workbook" },
            sheets: [],
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).success).toBe(false);
  });

  it("compiles a workbook with valid runtime configuration and token", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "genesis-workbook-route-"));
    temporaryDirectories.push(artifactRoot);

    process.env.GENESIS_RUNTIME_API_KEY = "expected-secret";
    process.env.GENESIS_ARTIFACT_ROOT = artifactRoot;
    process.env.GENESIS_RUNTIME_MAX_REQUEST_BYTES = "1048576";

    const response = await POST(
      new Request("http://localhost/api/genesis/workbook/compile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer expected-secret",
        },
        body: JSON.stringify({
          runId: "runtime-route-success",
          workbook: {
            spreadsheetId: "sheet-123",
            properties: { title: "Workbook" },
            sheets: [
              {
                properties: {
                  sheetId: 1,
                  title: "Sheet1",
                  index: 0,
                  gridProperties: {
                    rowCount: 10,
                    columnCount: 10,
                  },
                },
              },
            ],
          },
        }),
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.runId).toBe("runtime-route-success");
    expect(payload.artifact.type).toBe("WorkbookInventory");
    expect(payload.artifact.sha256).toHaveLength(64);
  });
});
