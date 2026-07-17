export interface WorkbookSheet {
  readonly id: number;
  readonly title: string;
  readonly index: number;
  readonly rowCount: number;
  readonly columnCount: number;
}

export interface WorkbookManifest {
  readonly spreadsheetId: string;
  readonly title: string;
  readonly sheets: readonly WorkbookSheet[];
}

export interface WorkbookInventory {
  readonly spreadsheetId: string;
  readonly generatedAt: string;
  readonly sheetCount: number;
  readonly sheets: readonly WorkbookSheet[];
}
