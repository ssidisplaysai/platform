import { describe, expect, it, jest } from "@jest/globals";

import { InventoryCompiler } from "../InventoryCompiler";
import type { WorkbookManifest } from "../types";

describe("InventoryCompiler", () => {
  it("creates workbook inventory metadata", () => {
    jest
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-07-16T00:00:00.000Z");

    const manifest: WorkbookManifest = {
      spreadsheetId: "sheet-123",
      title: "Blog Automation Queue",
      sheets: [
        {
          id: 1,
          title: "PSheet1",
          index: 0,
          rowCount: 200,
          columnCount: 20,
        },
      ],
    };

    const result = new InventoryCompiler().compile(manifest);

    expect(result).toEqual({
      spreadsheetId: "sheet-123",
      generatedAt: "2026-07-16T00:00:00.000Z",
      sheetCount: 1,
      sheets: manifest.sheets,
    });

    jest.restoreAllMocks();
  });
});
