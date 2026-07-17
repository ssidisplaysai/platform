import { ValidationError } from "../../compilers/core";
import type { WorkbookManifest } from "../../compilers/workbook";

import type { GoogleWorkbookMetadata } from "./types";

export class GoogleSheetsAdapter {
  public readonly id = "GoogleSheetsAdapter";

  public adapt(metadata: GoogleWorkbookMetadata): WorkbookManifest {
    const spreadsheetId = metadata.spreadsheetId?.trim();
    const title = metadata.properties?.title?.trim();
    const sheets = metadata.sheets;

    if (!spreadsheetId) {
      throw new ValidationError(
        "Google workbook metadata is missing spreadsheetId.",
        this.id,
      );
    }

    if (!title) {
      throw new ValidationError(
        "Google workbook metadata is missing workbook title.",
        this.id,
      );
    }

    if (!Array.isArray(sheets)) {
      throw new ValidationError(
        "Google workbook metadata is missing sheets.",
        this.id,
      );
    }

    return {
      spreadsheetId,
      title,
      sheets: sheets.map((sheet, fallbackIndex) => {
        const properties = sheet.properties;
        const sheetTitle = properties?.title?.trim();

        if (!sheetTitle) {
          throw new ValidationError(
            `Worksheet at position ${fallbackIndex} is missing a title.`,
            this.id,
          );
        }

        return {
          id: properties?.sheetId ?? fallbackIndex,
          title: sheetTitle,
          index: properties?.index ?? fallbackIndex,
          rowCount: properties?.gridProperties?.rowCount ?? 0,
          columnCount: properties?.gridProperties?.columnCount ?? 0,
        };
      }),
    };
  }
}
