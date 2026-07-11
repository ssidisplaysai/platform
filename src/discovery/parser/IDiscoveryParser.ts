/**
 * Genesis Discovery Engine — Parser Interfaces
 *
 * Defines the two-stage parsing contract:
 *
 *   Stage 1: IRawParser    — extracts raw text from a binary source (per page)
 *   Stage 2: IStructureParser — infers document structure from raw text
 *
 * Both stages preserve source fidelity. The structure parser classifies
 * blocks but never rewrites content. Future parsers (DOCX, Markdown, Audio)
 * implement the same interfaces and plug into the same pipeline.
 */

import type { DiscoveryDocument, DiscoveryInterview, DiscoverySourceType } from '../models';

// ---------------------------------------------------------------------------
// Stage 1: Raw extraction
// ---------------------------------------------------------------------------

/**
 * Per-page raw text output from Stage 1 parsing.
 */
export interface IRawPage {
  readonly pageNumber: number;
  readonly text: string;
}

/**
 * Complete output of Stage 1 parsing.
 */
export interface IRawParseResult {
  readonly pages: IRawPage[];
  readonly metadata: Record<string, unknown>;
  readonly totalPages: number;
}

/**
 * Stage 1 parser interface. Implementations are source-type specific.
 *
 * Responsibilities:
 *   - Read binary buffer and extract per-page text
 *   - Preserve original text exactly
 *   - Surface metadata from the file format (author, date, etc.)
 *   - Report failure via thrown Error (pipeline catches and records it)
 *
 * Must NOT:
 *   - Summarize or rephrase content
 *   - Make structural inferences
 *   - Reference business concepts
 */
export interface IRawParser {
  /**
   * Whether this parser handles the given source type.
   */
  canParse(sourceType: DiscoverySourceType): boolean;

  /**
   * Extract raw content from the binary buffer.
   * @param buffer  The file bytes
   * @param fileName  Original file name (for error messages)
   */
  parse(buffer: Buffer, fileName: string): Promise<IRawParseResult>;
}

// ---------------------------------------------------------------------------
// Stage 2: Structure parsing
// ---------------------------------------------------------------------------

/**
 * Stage 2 parser interface. Works on raw parse results and produces
 * DiscoveryDocument and DiscoveryInterview.
 *
 * Responsibilities:
 *   - Classify text blocks by structural role (heading, question, answer, etc.)
 *   - Detect section boundaries
 *   - Detect question/answer pairs
 *   - Preserve exact wording in all structured fields
 *   - Emit diagnostics for ambiguous or missing structure
 *
 * Must NOT:
 *   - Rewrite any text
 *   - Summarize answers
 *   - Infer missing information
 *   - Classify business concepts (capability, process, rule, etc.)
 */
export interface IStructureParser {
  /**
   * Transform a raw parse result into a DiscoveryDocument.
   * @param raw  Output from IRawParser.parse()
   * @param sourceId  ID of the originating DiscoverySource
   * @param fileName  Original file name
   */
  parseDocument(raw: IRawParseResult, sourceId: string, fileName: string): DiscoveryDocument;

  /**
   * Extract interview structure from a DiscoveryDocument.
   * @param document  Output from parseDocument()
   */
  parseInterview(document: DiscoveryDocument): DiscoveryInterview;
}
