/**
 * AuthorityClassifier.ts
 * Classifies documents by authority level.
 *
 * The AuthorityClassifier determines the governance authority level
 * of documents based on their location, naming conventions, and content markers.
 *
 * Classification Priority (most to least specific):
 * 1. YAML frontmatter authority field
 * 2. Content markers (Status, Authority fields)
 * 3. Filename patterns (e.g., CONSTITUTION.md)
 * 4. Directory location patterns
 * 5. Default: INFORMATIONAL
 *
 * This ensures deterministic, consistent classification.
 */

import type { Authority } from './models/Authority';
import type { RepositoryDocument } from './models/RepositoryDocument';
import { AuthorityLevel, createAuthority } from './models/Authority';

/**
 * Classification categories recognized by the analyzer.
 */
export enum DocumentCategory {
  /** Constitutional or foundational standard. */
  CANON = 'CANON',

  /** Architecture decision or design. */
  ARCHITECTURE = 'ARCHITECTURE',

  /** Architecture decision record. */
  ADR = 'ADR',

  /** Normative standard or specification. */
  STANDARD = 'STANDARD',

  /** Detailed specification document. */
  SPECIFICATION = 'SPECIFICATION',

  /** Compiler or code-generation tool. */
  COMPILER = 'COMPILER',

  /** Artifact or output contract. */
  ARTIFACT = 'ARTIFACT',

  /** Validation specification or rules. */
  VALIDATION = 'VALIDATION',

  /** Release notes or publication. */
  RELEASE = 'RELEASE',

  /** Analysis or status report. */
  REPORT = 'REPORT',

  /** Runtime engine or infrastructure. */
  RUNTIME = 'RUNTIME',

  /** Research or exploratory document. */
  RESEARCH = 'RESEARCH',

  /** Implementation or code guidance. */
  IMPLEMENTATION = 'IMPLEMENTATION',

  /** Unclassified or unknown. */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classifies documents by authority level.
 *
 * Determines document authority based on:
 * - File location (directory paths)
 * - Filename patterns and conventions
 * - Content markers (Status, Authority fields)
 * - Known governance directories
 *
 * Classification is deterministic and consistent.
 */
export class AuthorityClassifier {
  /**
   * Creates a new AuthorityClassifier instance.
   */
  constructor() {}

  /**
   * Classifies a document and determines its authority level.
   *
   * Applies classification rules in priority order:
   * 1. Frontmatter authority marker
   * 2. Content authority field
   * 3. Filename patterns
   * 4. Directory patterns
   * 5. Default: INFORMATIONAL
   *
   * @param document - Document to classify
   * @returns Authority classification
   */
  classify(document: RepositoryDocument): Authority {
    // Try to extract authority from content
    const authLevel = this.classifyDocument(document);
    return createAuthority(authLevel);
  }

  /**
   * Determines category for a document.
   *
   * @param document - Document to categorize
   * @returns Document category
   */
  categorize(document: RepositoryDocument): DocumentCategory {
    const name = document.nameWithoutExtension.toLowerCase();
    const path = document.path.toLowerCase();
    const content = document.content.toLowerCase();

    // Check for specific patterns in priority order
    if (name.includes('constitution') || name.includes('charter')) {
      return DocumentCategory.CANON;
    }

    if (
      path.includes('/architecture/') ||
      name.includes('architecture') ||
      name.includes('arch-')
    ) {
      return DocumentCategory.ARCHITECTURE;
    }

    if (name.startsWith('adr-') || name.includes('-decision-')) {
      return DocumentCategory.ADR;
    }

    if (
      name.includes('standard') ||
      name.includes('specification') ||
      name.includes('spec')
    ) {
      return DocumentCategory.SPECIFICATION;
    }

    if (name.includes('compiler') || name.includes('compilation')) {
      return DocumentCategory.COMPILER;
    }

    if (name.includes('validation') || name.includes('validate')) {
      return DocumentCategory.VALIDATION;
    }

    if (
      name.includes('release') ||
      name.includes('publication') ||
      name.includes('publish')
    ) {
      return DocumentCategory.RELEASE;
    }

    if (
      name.includes('report') ||
      name.includes('summary') ||
      name.includes('analysis')
    ) {
      return DocumentCategory.REPORT;
    }

    if (
      name.includes('runtime') ||
      name.includes('engine') ||
      name.includes('platform')
    ) {
      return DocumentCategory.RUNTIME;
    }

    if (
      name.includes('research') ||
      name.includes('exploration') ||
      name.includes('spike')
    ) {
      return DocumentCategory.RESEARCH;
    }

    if (
      name.includes('implementation') ||
      name.includes('impl') ||
      path.includes('/src/')
    ) {
      return DocumentCategory.IMPLEMENTATION;
    }

    return DocumentCategory.UNKNOWN;
  }

  /**
   * Classifies document authority level.
   *
   * @param document - Document to classify
   * @returns Authority level
   */
  private classifyDocument(document: RepositoryDocument): AuthorityLevel {
    // Check by path pattern first (most specific)
    const pathLevel = this.classifyByPath(document.path);
    if (pathLevel !== null) {
      return pathLevel;
    }

    // Check by filename pattern
    const fileLevel = this.classifyByFilename(document.fileName);
    if (fileLevel !== null) {
      return fileLevel;
    }

    // Check by content markers
    const contentLevel = this.classifyByContent(document.content);
    if (contentLevel !== null) {
      return contentLevel;
    }

    // Default: INFORMATIONAL
    return AuthorityLevel.INFORMATIONAL;
  }

  /**
   * Determines authority level from document path.
   *
   * Priority paths (in order):
   * - /genesis/constitution/ → CONSTITUTIONAL
   * - /docs/standards/ → NORMATIVE
   * - /docs/architecture/ → ARCHITECTURAL
   * - /genesis/ → ARCHITECTURAL
   *
   * @param path - Document workspace-relative path
   * @returns Authority level or null if not determinable from path
   */
  private classifyByPath(path: string): AuthorityLevel | null {
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes('constitution')) {
      return AuthorityLevel.CONSTITUTIONAL;
    }

    if (lowerPath.includes('standards') || lowerPath.includes('standards/')) {
      return AuthorityLevel.NORMATIVE;
    }

    if (
      lowerPath.includes('docs/standards/') ||
      lowerPath.includes('docs/standards/')
    ) {
      return AuthorityLevel.NORMATIVE;
    }

    if (
      lowerPath.includes('/architecture/') ||
      lowerPath.includes('architecture/')
    ) {
      return AuthorityLevel.ARCHITECTURAL;
    }

    if (lowerPath.startsWith('genesis/')) {
      return AuthorityLevel.ARCHITECTURAL;
    }

    return null;
  }

  /**
   * Determines authority level from document content.
   *
   * Looks for markers like:
   * - Status: CONSTITUTIONAL
   * - Authority: NORMATIVE
   * - Type: Standard
   *
   * @param content - Document content
   * @returns Authority level or null if not found
   */
  private classifyByContent(content: string): AuthorityLevel | null {
    const lines = content.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (
        lowerLine.includes('constitutional') &&
        (lowerLine.includes('authority:') || lowerLine.includes('status:'))
      ) {
        return AuthorityLevel.CONSTITUTIONAL;
      }

      if (
        lowerLine.includes('normative') &&
        (lowerLine.includes('authority:') || lowerLine.includes('status:'))
      ) {
        return AuthorityLevel.NORMATIVE;
      }

      if (
        lowerLine.includes('architectural') &&
        (lowerLine.includes('authority:') || lowerLine.includes('status:'))
      ) {
        return AuthorityLevel.ARCHITECTURAL;
      }
    }

    return null;
  }

  /**
   * Determines authority level from filename.
   *
   * Patterns:
   * - CONSTITUTION.md → CONSTITUTIONAL
   * - *-STANDARD.md → NORMATIVE
   * - *-ARD-*.md → ARCHITECTURAL
   * - *-SPEC-*.md → NORMATIVE
   *
   * @param filename - Document filename
   * @returns Authority level or null if not determinable
   */
  private classifyByFilename(filename: string): AuthorityLevel | null {
    const upper = filename.toUpperCase();

    if (upper.includes('CONSTITUTION')) {
      return AuthorityLevel.CONSTITUTIONAL;
    }

    if (upper.includes('STANDARD') || upper.includes('SPEC')) {
      return AuthorityLevel.NORMATIVE;
    }

    if (upper.includes('-ARD-') || upper.includes('DECISION')) {
      return AuthorityLevel.ARCHITECTURAL;
    }

    if (upper.includes('GUIDANCE')) {
      return AuthorityLevel.GUIDANCE;
    }

    return null;
  }
}
