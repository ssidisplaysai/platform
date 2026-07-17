export interface GoogleGridProperties {
  readonly rowCount?: number;
  readonly columnCount?: number;
}

export interface GoogleSheetProperties {
  readonly sheetId?: number;
  readonly title?: string;
  readonly index?: number;
  readonly sheetType?: string;
  readonly hidden?: boolean;
  readonly gridProperties?: GoogleGridProperties;
}

export interface GoogleSheet {
  readonly properties?: GoogleSheetProperties;
}

export interface GoogleWorkbookMetadata {
  readonly spreadsheetId?: string;
  readonly properties?: {
    readonly title?: string;
  };
  readonly sheets?: readonly GoogleSheet[];
}
