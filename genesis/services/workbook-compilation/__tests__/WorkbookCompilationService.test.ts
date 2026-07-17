import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "@jest/globals";

import { WorkbookCompilationService } from "../WorkbookCompilationService";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("WorkbookCompilationService", () => {
  it("compiles a workbook end-to-end", async () => {
    const artifactRoot = await mkdtemp(
      join(tmpdir(), "genesis-service-"),
    );

    temporaryDirectories.push(artifactRoot);

    const service = new WorkbookCompilationService();

    const result = await service.compile({
      artifactRoot,
      workbook: {
        spreadsheetId: "sheet-123",
        properties: {
          title: "Genesis Workbook",
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

    expect(result.manifest.title).toBe("Genesis Workbook");
    expect(result.inventoryPath).toContain("workbook-inventory.json");
    expect(result.sha256).toHaveLength(64);
  });
});
