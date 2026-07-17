import { describe, expect, it } from "@jest/globals";

import { ValidationError } from "../../../compilers/core";
import { GoogleSheetsAdapter } from "../GoogleSheetsAdapter";
import type { GoogleWorkbookMetadata } from "../types";

describe("GoogleSheetsAdapter", () => {
  it("converts Google workbook metadata into a WorkbookManifest", () => {
    const metadata: GoogleWorkbookMetadata = {
      spreadsheetId: "sheet-123",
      properties: {
        title: "Blog Automation Queue",
      },
      sheets: [
        {
          properties: {
            sheetId: 1170623655,
            title: "PSheet1",
            index: 9,
            sheetType: "GRID",
            gridProperties: {
              rowCount: 1012,
              columnCount: 32,
            },
          },
        },
        {
          properties: {
            sheetId: 74673542,
            title: "Products",
            index: 23,
            sheetType: "GRID",
            gridProperties: {
              rowCount: 999,
              columnCount: 26,
            },
          },
        },
      ],
    };

    const manifest = new GoogleSheetsAdapter().adapt(metadata);

    expect(manifest).toEqual({
      spreadsheetId: "sheet-123",
      title: "Blog Automation Queue",
      sheets: [
        {
          id: 1170623655,
          title: "PSheet1",
          index: 9,
          rowCount: 1012,
          columnCount: 32,
        },
        {
          id: 74673542,
          title: "Products",
          index: 23,
          rowCount: 999,
          columnCount: 26,
        },
      ],
    });
  });

  it("uses deterministic defaults for optional Google fields", () => {
    const manifest = new GoogleSheetsAdapter().adapt({
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
    });

    expect(manifest.sheets[0]).toEqual({
      id: 0,
      title: "Sheet1",
      index: 0,
      rowCount: 0,
      columnCount: 0,
    });
  });

  it.each([
    [
      {
        properties: { title: "Workbook" },
        sheets: [],
      },
      "spreadsheetId",
    ],
    [
      {
        spreadsheetId: "sheet-123",
        sheets: [],
      },
      "workbook title",
    ],
    [
      {
        spreadsheetId: "sheet-123",
        properties: { title: "Workbook" },
      },
      "sheets",
    ],
  ])("rejects malformed metadata", (metadata, expectedMessage) => {
    expect(() =>
      new GoogleSheetsAdapter().adapt(metadata),
    ).toThrow(expectedMessage);
  });

  it("rejects worksheets without titles", () => {
    expect(() =>
      new GoogleSheetsAdapter().adapt({
        spreadsheetId: "sheet-123",
        properties: {
          title: "Workbook",
        },
        sheets: [
          {
            properties: {
              sheetId: 1,
            },
          },
        ],
      }),
    ).toThrow(ValidationError);
  });
});
