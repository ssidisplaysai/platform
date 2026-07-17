import type { WorkbookInventory, WorkbookManifest } from "./types";

export class InventoryCompiler {
  public compile(manifest: WorkbookManifest): WorkbookInventory {
    return {
      spreadsheetId: manifest.spreadsheetId,
      generatedAt: new Date().toISOString(),
      sheetCount: manifest.sheets.length,
      sheets: manifest.sheets,
    };
  }
}
