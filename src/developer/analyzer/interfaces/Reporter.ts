/**
 * Reporter.ts
 * Public interface contract for report generation.
 *
 * The ReportGenerator interface defines the contract for producing
 * analysis reports in various formats.
 */

/**
 * Report format enumeration.
 */
export enum ReportFormat {
  /** JSON format (machine-readable). */
  JSON = 'JSON',

  /** Markdown format (human-readable). */
  MARKDOWN = 'MARKDOWN',

  /** HTML format (browser-readable). */
  HTML = 'HTML',

  /** Plain text format. */
  TEXT = 'TEXT',
}

/**
 * Public interface for report generation.
 *
 * The ReportGenerator produces formatted analysis reports suitable for
 * different audiences and use cases.
 *
 * Report generation is deterministic: identical input always produces
 * identical output (assuming stable template/styling).
 *
 * @readonly All properties are read-only to prevent mutation.
 */
export interface IReportGenerator {
  /**
   * Generates a report in the specified format.
   *
   * @param reportData - Complete analysis report data (JSON-serializable)
   * @param format - Output format (JSON, Markdown, HTML, or Text)
   * @returns Generated report as string
   * @throws Error if format is not supported
   */
  generate(reportData: unknown, format: ReportFormat): Promise<string>;

  /**
   * Writes generated report to a file.
   *
   * @param filePath - Absolute file path to write report to
   * @param reportData - Complete analysis report data
   * @param format - Output format
   * @returns Promise that resolves when write is complete
   * @throws Error if file cannot be written
   */
  writeToFile(
    filePath: string,
    reportData: unknown,
    format: ReportFormat,
  ): Promise<void>;

  /**
   * Gets the list of supported report formats.
   *
   * @returns Array of supported formats, sorted ascending
   */
  getSupportedFormats(): readonly ReportFormat[];

  /**
   * Gets the recommended file extension for a given format.
   *
   * @param format - Report format
   * @returns File extension including dot (e.g., ".json", ".md")
   */
  getFileExtension(format: ReportFormat): string;
}
