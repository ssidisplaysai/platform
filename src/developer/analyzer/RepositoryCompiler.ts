/**
 * RepositoryCompiler.ts
 * Main orchestrator for repository compilation.
 *
 * The RepositoryCompiler coordinates compilation stages to discover and inventory
 * repository documentation. Current scope: inventory generation only (scanning,
 * parsing, and classification).
 */

import type { IRepositoryCompiler } from './interfaces/Compiler';
import type { RepositoryReport } from './models/RepositoryReport';
import type { RepositoryDocument } from './models/RepositoryDocument';
import { RepositoryScanner } from './RepositoryScanner';
import { DocumentParser } from './DocumentParser';
import { AuthorityClassifier } from './AuthorityClassifier';
import { createRepositoryReport } from './models/RepositoryReport';
import { deepFreeze } from './utils/deepFreeze';

const COMPILER_VERSION = '1.0.0';

/**
 * Main orchestrator for repository inventory compilation.
 *
 * Coordinates compilation stages to produce repository inventory:
 * 1. Scans repository for documents
 * 2. Parses document content and metadata
 * 3. Classifies document authority
 * 4. Returns immutable RepositoryDocument collection
 *
 * All compilation is deterministic: identical repositories always
 * produce identical inventories.
 *
 * Current scope: Inventory generation only. Dependency analysis,
 * conflict detection, and health scoring not implemented.
 */
export class RepositoryCompiler implements IRepositoryCompiler {
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
   * Creates a new RepositoryCompiler instance.
   *
   * Initializes all component compilers and prepares for compilation.
   */
  constructor() {
    this.scanner = new RepositoryScanner();
    this.parser = new DocumentParser();
    this.classifier = new AuthorityClassifier();
  }

  /**
   * Compiles the repository at the given root path.
   *
   * Performs end-to-end compilation (inventory generation):
   * - Discovers all documents in repository tree
   * - Extracts content and metadata
   * - Classifies authority levels
   * - Returns immutable collection
   *
   * Compilation is deterministic: identical repository structures
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
  async compile(repositoryRoot: string): Promise<RepositoryReport> {
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
      analyzerVersion: COMPILER_VERSION,
      documents: deepFreeze([...classifiedDocuments]),
    } as RepositoryReport;

    // Deep freeze the entire report
    return deepFreeze(frozenReport);
  }

  /**
   * Gets the current compiler version.
   *
   * @returns Version string (e.g., "1.0.0")
   */
  getVersion(): string {
    return COMPILER_VERSION;
  }

  /**
   * Validates that the compiler is properly configured.
   *
   * @returns true if all dependencies and configuration are valid
   */
  isConfigured(): boolean {
    return (
      this.scanner != null && this.parser != null && this.classifier != null
    );
  }
}
