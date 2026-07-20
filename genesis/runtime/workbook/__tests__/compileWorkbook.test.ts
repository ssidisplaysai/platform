import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "@jest/globals";

import { compileWorkbook } from "../compileWorkbook";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("compileWorkbook", () => {
  it("compiles Google metadata through the Genesis runtime boundary", async () => {
    const artifactRoot = await mkdtemp(
      join(tmpdir(), "genesis-workbook-runtime-"),
    );

    temporaryDirectories.push(artifactRoot);

    const result = await compileWorkbook({
      runId: "runtime-test-001",
      artifactRoot,
      workbook: {
        spreadsheetId: "sheet-123",
        properties: {
          title: "Blog Automation Queue",
        },
        sheets: [
          {
            properties: {
              sheetId: 1,
              title: "PSheet1",
              index: 0,
              gridProperties: {
                rowCount: 100,
                columnCount: 20,
              },
            },
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(result.runId).toBe("runtime-test-001");
    expect(result.manifest.sheets).toHaveLength(1);
    expect(result.inventory.sheetCount).toBe(1);
    expect(result.artifact.path).toContain(
      "payload.json",
    );
    expect(result.artifact.sha256).toHaveLength(64);
  });

  it("uses a deterministic default run ID", async () => {
    const artifactRoot = await mkdtemp(
      join(tmpdir(), "genesis-workbook-runtime-"),
    );

    temporaryDirectories.push(artifactRoot);

    const result = await compileWorkbook({
      artifactRoot,
      workbook: {
        spreadsheetId: "sheet-123",
        properties: {
          title: "Workbook",
        },
        sheets: [
          {
            properties: {
              title: "Sheet1",
            },
          },
        ],
      },
    });

    expect(result.runId).toBe("workbook-runtime");
  });
});
