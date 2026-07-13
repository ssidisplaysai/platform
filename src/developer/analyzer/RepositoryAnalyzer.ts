/**
 * RepositoryAnalyzer.ts
 * Main orchestrator for repository analysis.
 *
 * The RepositoryAnalyzer coordinates analysis stages to discover and inventory
 * repository documentation. Current scope: inventory generation only (scanning,
 * parsing, and classification).
 */

import type { IRepositoryAnalyzer } from './interfaces/Analyzer';
import type { RepositoryReport } from './models/RepositoryReport';
import type { RepositoryDocument } from './models/RepositoryDocument';
import { RepositoryScanner } from './RepositoryScanner';
import { DocumentParser } from './DocumentParser';
import { AuthorityClassifier } from './AuthorityClassifier';
import { createRepositoryReport } from './models/RepositoryReport';
import { deepFreeze } from './utils/deepFreeze';

const ANALYZER_VERSION = '1.0.0';

/**
 * Main orchestrator for repository inventory analysis.
 *
 * Coordinates analysis stages to produce repository inventory:
 * 1. Scans repository for documents
 * 2. Parses document content and metadata
 * 3. Classifies document authority
 * 4. Returns immutable RepositoryDocument collection
 *
 * All analysis is deterministic: identical repositories always
 * produce identical inventories.
 *
 * Current scope: Inventory generation only. Dependency analysis,
 * conflict detection, and health scoring not implemented.
 */
export class RepositoryAnalyzer implements IRepositoryAnalyzer {
  /**
   * Repository scanner instance.
   * @readonly
   */
  private readonly scanner: RepositoryScanner;

  /**
   * Document parser instance.
   * @readonly
   */
  private readonly parser: DocumentParser;

  /**
   * Authority classifier instance.
   * @readonly
   */
  private readonly classifier: AuthorityClassifier;

  /**
   * Creates a new RepositoryAnalyzer instance.
   *
   * Initializes all component analyzers and prepares for analysis.
   */
  constructor() {
    this.scanner = new RepositoryScanner();
    this.parser = new DocumentParser();
    this.classifier = new AuthorityClassifier();
  }

  /**
   * Analyzes the repository at the given root path.
   *
   * Performs end-to-end analysis (inventory generation):
   * - Discovers all documents in repository tree
   * - Extracts content and metadata
   * - Classifies authority levels
   * - Returns immutable collection
   *
   * Analysis is deterministic: identical repository structures
   * always produce identical reports.
   *
   * Note: Current implementation generates inventory only.
   * Dependency analysis, conflict detection, and health scoring
   * are not performed.
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to complete RepositoryReport (fully frozen)
   * @throws Error if repository root is invalid or inaccessible
   */
  async analyze(repositoryRoot: string): Promise<RepositoryReport> {
    const startTime = Date.now();

    // Step 1: Scan repository (deterministic discovery + ordering)
    const scannedDocuments = await this.scanner.scan(repositoryRoot);

    // Step 2: Parse documents (extract metadata from content)
    const parsedDocuments = scannedDocuments.map(doc => this.parser.parse(doc));

    // Step 3: Classify authority (deterministic classification)
    const classifiedDocuments = parsedDocuments.map(doc => ({
      ...doc,
      authority: this.classifier.classify(doc),
    })) as readonly RepositoryDocument[];

    const endTime = Date.now();

    // Generate inventory report
    const report = createRepositoryReport(repositoryRoot, classifiedDocuments);

    // Create final report with frozen documents array
    const frozenReport = {
      ...report,
      analysisDurationMs: endTime - startTime,
      analyzedAt: new Date().toISOString(),
      analyzerVersion: ANALYZER_VERSION,
      documents: deepFreeze([...classifiedDocuments]),
    } as RepositoryReport;

    // Deep freeze the entire report
    return deepFreeze(frozenReport);
  }

  /**
   * Gets the current analyzer version.
   *
   * @returns Version string (e.g., "1.0.0")
   */
  getVersion(): string {
    return ANALYZER_VERSION;
  }

  /**
   * Validates that the analyzer is properly configured.
   *
   * @returns true if all dependencies and configuration are valid
   */
  isConfigured(): boolean {
    return (
      this.scanner != null && this.parser != null && this.classifier != null
    );
  }
}
