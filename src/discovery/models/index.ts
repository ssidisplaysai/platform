/**
 * Genesis Discovery Engine — Discovery Layer Models
 *
 * These are the canonical data structures for the first stage of the
 * Genesis Enterprise Compiler. They represent discovered knowledge
 * exactly as it was found in the source — no inference, no interpretation.
 *
 * Pipeline position:
 *   Discovery Source → Discovery Document → Discovery Evidence
 *
 * Do NOT reference Evidence IR, Business Genome, or Runtime here.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * All supported source file types for the Discovery importer.
 * Future importers plug in by supporting additional types.
 */
export type DiscoverySourceType =
  | 'pdf'
  | 'docx'
  | 'markdown'
  | 'transcript'
  | 'email'
  | 'chat'
  | 'form'
  | 'audio'
  | 'video'
  | 'unknown';

/**
 * The structural role of a text block within a page.
 */
export type DiscoveryBlockType =
  | 'heading'
  | 'section_header'
  | 'question'
  | 'answer'
  | 'paragraph'
  | 'metadata'
  | 'list_item'
  | 'blank'
  | 'unknown';

/**
 * Severity level for diagnostic messages.
 */
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

/**
 * Canonical diagnostic codes emitted by the Discovery Engine.
 * These codes are stable identifiers for downstream tooling.
 */
export enum DiagnosticCode {
  // Source-level
  SOURCE_NOT_FOUND = 'DISC_001',
  SOURCE_TYPE_UNSUPPORTED = 'DISC_002',
  SOURCE_FILE_EMPTY = 'DISC_003',

  // Document-level
  DOCUMENT_LOAD_FAILED = 'DISC_010',
  INVALID_PDF = 'DISC_011',
  CORRUPTED_PAGE = 'DISC_012',
  UNSUPPORTED_FORMATTING = 'DISC_013',

  // Extraction-level
  TEXT_EXTRACTION_FAILED = 'DISC_020',
  EMPTY_PAGE = 'DISC_021',
  PAGE_REFERENCE_LOST = 'DISC_022',

  // Structure-level
  SECTION_DETECTION_FAILED = 'DISC_030',
  MISSING_SECTION = 'DISC_031',
  AMBIGUOUS_STRUCTURE = 'DISC_032',
  NO_STRUCTURE_DETECTED = 'DISC_033',

  // Interview-level
  QUESTION_EXTRACTION_FAILED = 'DISC_040',
  ANSWER_EXTRACTION_FAILED = 'DISC_041',
  EMPTY_ANSWER = 'DISC_042',
  DUPLICATE_QUESTION = 'DISC_043',
  QUESTION_WITHOUT_ANSWER = 'DISC_044',

  // Metadata-level
  MISSING_METADATA = 'DISC_050',
  MISSING_PARTICIPANT = 'DISC_051',
  MISSING_INTERVIEW_DATE = 'DISC_052',
  MISSING_INTERVIEWER = 'DISC_053',

  // Validation-level
  VALIDATION_FAILED = 'DISC_060',
}

// ---------------------------------------------------------------------------
// Core discovery structures
// ---------------------------------------------------------------------------

/**
 * A structured diagnostic message produced at any stage of import.
 * Diagnostics are accumulated, never thrown away. They accompany the
 * output so consumers can audit what happened during extraction.
 */
export interface DiscoveryDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly context?: string;
  readonly pageNumber?: number;
  readonly blockIndex?: number;
  readonly questionId?: string;
  readonly sectionTitle?: string;
  readonly timestamp: string; // ISO 8601
}

/**
 * Document-level metadata extracted from the source file.
 * Values are preserved exactly as found — no normalization.
 */
export interface DiscoveryMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly keywords?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly createdAt?: string;
  readonly modifiedAt?: string;
  readonly pageCount: number;
  readonly raw: Record<string, unknown>;
}

/**
 * A contiguous segment of text within a page, classified by structural role.
 * The `raw` field always holds the original unmodified text.
 */
export interface DiscoveryBlock {
  readonly type: DiscoveryBlockType;
  readonly text: string;
  readonly raw: string;
  readonly pageNumber: number;
  readonly blockIndex: number;
  readonly lineStart?: number;
  readonly lineEnd?: number;
}

/**
 * A single page from the source document.
 * All text content is preserved verbatim.
 */
export interface DiscoveryPage {
  readonly pageNumber: number;
  readonly text: string;
  readonly blocks: DiscoveryBlock[];
  readonly isEmpty: boolean;
}

/**
 * The original file record. This is the immutable lineage anchor —
 * every derived artifact references back to its sourceId.
 */
export interface DiscoverySource {
  readonly sourceId: string;
  readonly sourceType: DiscoverySourceType;
  readonly fileName: string;
  readonly filePath: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly importedAt: string; // ISO 8601
}

/**
 * A normalized, faithful representation of the original source file.
 * This is not a summary. It is the full content of the source
 * reorganized into a stable, addressable structure.
 */
export interface DiscoveryDocument {
  readonly sourceId: string;
  readonly sourceType: DiscoverySourceType;
  readonly fileName: string;
  readonly pageCount: number;
  readonly metadata: DiscoveryMetadata;
  readonly pages: DiscoveryPage[];
  readonly diagnostics: DiscoveryDiagnostic[];
}

// ---------------------------------------------------------------------------
// Interview evidence structures
// ---------------------------------------------------------------------------

/**
 * A single answer extracted from a Discovery Interview.
 * The `raw` field contains the original text exactly as extracted.
 */
export interface DiscoveryAnswer {
  readonly id: string;
  readonly text: string;
  readonly raw: string;
  readonly pageNumber: number;
  readonly order: number;
}

/**
 * A question/answer pair from a Discovery Interview.
 * `question` and `answer` hold the complete text as it appeared
 * in the source — never rewritten, never summarized.
 */
export interface DiscoveryQuestion {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly rawQuestion: string;
  readonly rawAnswer: string;
  readonly page: number;
  readonly order: number;
  readonly answerPages: number[];
}

/**
 * A named section grouping related questions within an interview.
 */
export interface DiscoverySection {
  readonly title: string;
  readonly order: number;
  readonly startPage: number;
  readonly questions: DiscoveryQuestion[];
}

/**
 * The primary structured output of Discovery Interview extraction.
 * Represents one interview with a single participant, faithfully
 * preserving the full question/answer content in section order.
 */
export interface DiscoveryInterview {
  readonly interviewId: string;
  readonly participant: string;
  readonly role: string;
  readonly department: string;
  readonly interviewDate: string;
  readonly interviewer: string;
  readonly sourceId: string;
  readonly sections: DiscoverySection[];
  readonly rawMetadata: Record<string, string>;
  readonly diagnostics: DiscoveryDiagnostic[];
}

// ---------------------------------------------------------------------------
// Pipeline result structures
// ---------------------------------------------------------------------------

/**
 * Outcome of a validation pass over a Discovery Document or Interview.
 */
export interface DiscoveryValidationResult {
  readonly valid: boolean;
  readonly errors: DiscoveryDiagnostic[];
  readonly warnings: DiscoveryDiagnostic[];
  readonly infos: DiscoveryDiagnostic[];
}

/**
 * The complete result of a Discovery import operation.
 * Contains the source record, extracted document, extracted interview,
 * all validation results, and the full diagnostic log.
 *
 * A failed import still returns a result — it never throws away
 * partial data. Check `success` and `diagnostics` for details.
 */
export interface DiscoveryImportResult {
  readonly success: boolean;
  readonly source: DiscoverySource;
  readonly document?: DiscoveryDocument;
  readonly interview?: DiscoveryInterview;
  readonly validation: DiscoveryValidationResult;
  readonly diagnostics: DiscoveryDiagnostic[];
  readonly timestamp: string; // ISO 8601
}
