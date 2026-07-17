import { describe, expect, it } from "@jest/globals";

import { ManifestCompiler } from "../ManifestCompiler";
import type { WorkbookManifest } from "../types";

describe("ManifestCompiler", () => {
  it("sorts worksheets by index deterministically", () => {
    const manifest: WorkbookManifest = {
      spreadsheetId: "sheet-123",
      title: "Blog Automation Queue",
      sheets: [
        {
          id: 2,
          title: "Products",
          index: 2,
          rowCount: 100,
          columnCount: 10,
        },
        {
          id: 1,
          title: "PSheet1",
          index: 0,
          rowCount: 200,
          columnCount: 20,
        },
        {
          id: 3,
          title: "States",
          index: 1,
          rowCount: 50,
          columnCount: 5,
        },
      ],
    };

    const result = new ManifestCompiler().compile(manifest);

    expect(result.sheets.map((sheet) => sheet.title)).toEqual([
      "PSheet1",
      "States",
      "Products",
    ]);
  });
});
