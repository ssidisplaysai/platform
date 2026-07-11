/**
 * Genesis Discovery Engine — Interview Structure Parser
 *
 * Stage 2 parser. Converts raw per-page text into a DiscoveryDocument
 * with classified blocks, then extracts a DiscoveryInterview with
 * section/question/answer structure.
 *
 * Design principles:
 *   - Preserve exact wording. Never rewrite a single character of content.
 *   - Never infer. Only classify what structural markers make explicit.
 *   - When structure is ambiguous, emit a diagnostic and keep the raw text.
 *   - All IDs are deterministic (content-hash based) for auditability.
 *
 * This parser handles the following interview document conventions:
 *   - Numbered questions: Q1, Q1:, Q1., 1., 1), Question 1:
 *   - Section headers: SECTION 1, Section 1:, Part I, ALL CAPS headings
 *   - Metadata headers: Participant:, Role:, Date:, Interviewer:
 *   - Multi-paragraph answers separated by blank lines
 *   - Questions that span multiple lines before the answer begins
 *   - Page-spanning content (answer that continues onto the next page)
 */

import { DiagnosticsCollector } from '../diagnostics';
import {
  DiagnosticCode,
  DiscoveryBlock,
  DiscoveryBlockType,
  DiscoveryDocument,
  DiscoveryInterview,
  DiscoveryMetadata,
  DiscoveryPage,
  DiscoveryQuestion,
  DiscoverySection,
  DiscoverySourceType,
} from '../models';
import type { IRawParseResult, IStructureParser } from './IDiscoveryParser';

// ---------------------------------------------------------------------------
// Internal line representation used during parsing
// ---------------------------------------------------------------------------

interface TaggedLine {
  text: string;
  trimmed: string;
  pageNumber: number;
  lineIndexOnPage: number;
  globalLineIndex: number;
}

type LineTag =
  | 'blank'
  | 'metadata'
  | 'section_header'
  | 'question_marker'
  | 'content';

interface ClassifiedLine extends TaggedLine {
  tag: LineTag;
  metadataKey?: string;
  metadataValue?: string;
}

// Internal mutable question accumulator
interface QuestionAccumulator {
  id: string;
  order: number;
  questionLines: string[];
  answerLines: string[];
  startPage: number;
  answerPages: Set<number>;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Metadata field patterns.
 * These detect "Key: Value" pairs in the first portion of the document.
 */
const METADATA_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'participant', pattern: /^(?:participant|interviewee|name|respondent)\s*:\s*(.+)$/i },
  { key: 'role', pattern: /^(?:role|title|position|job title)\s*:\s*(.+)$/i },
  { key: 'department', pattern: /^(?:department|division|team|group|unit)\s*:\s*(.+)$/i },
  { key: 'interviewDate', pattern: /^(?:date|interview date|conducted on|session date)\s*:\s*(.+)$/i },
  { key: 'interviewer', pattern: /^(?:interviewer|conducted by|facilitator|by)\s*:\s*(.+)$/i },
  { key: 'company', pattern: /^(?:company|organization|employer|business)\s*:\s*(.+)$/i },
  { key: 'location', pattern: /^(?:location|site|office)\s*:\s*(.+)$/i },
  { key: 'duration', pattern: /^(?:duration|length|time)\s*:\s*(.+)$/i },
];

/**
 * Section header patterns — ordered from most specific to least specific.
 */
const SECTION_HEADER_PATTERNS: RegExp[] = [
  /^#{1,3}\s+\S/,                                                   // Markdown ## Section
  /^(?:section|SECTION)\s+\d+\s*[:\-–—]\s*\S/i,                   // Section 1: Title
  /^(?:part|PART)\s+[IVX\d]+\s*[:\-–—]\s*\S/i,                    // Part I: Title
  /^(?:phase|PHASE)\s+\d+\s*[:\-–—]\s*\S/i,                       // Phase 1: Title
  /^(?:category|CATEGORY|topic|TOPIC|area|AREA)\s*[:\-–—]\s*\S/i,  // Category: Title
  /^\d+\.\s{1,3}[A-Z][A-Za-z\s]{2,50}$(?<![\?!])/,               // 1. Title Case (no ? or !)
];

/**
 * ALL-CAPS heading pattern: 3+ uppercase words, no digits in most of it,
 * does not look like an acronym-heavy sentence.
 */
const ALL_CAPS_HEADING_PATTERN = /^[A-Z][A-Z\s\-–—&/]{4,60}$/;

/**
 * Question marker patterns — ordered from most specific to least specific.
 */
const QUESTION_MARKER_PATTERNS: RegExp[] = [
  /^Q\.?\s*\d+\s*[:.)\s]/i,             // Q1: Q1. Q1) Q 1.
  /^(?:question|QUESTION)\s+\d+\s*[:.]/i, // Question 1:
  /^\d{1,2}\s*[.)]\s+\S/,              // 1. or 1) followed by content
  /^\d{1,2}\s*:\s+\S/,                 // 1: followed by content
];

/**
 * A line that is a question if it:
 *   - Is short (≤ 220 chars)
 *   - Ends with a question mark
 *   - Does not look like a section header
 */
function looksLikeQuestion(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length >= 10 &&
    trimmed.length <= 220 &&
    trimmed.endsWith('?')
  );
}

// ---------------------------------------------------------------------------
// Deterministic ID generation
// ---------------------------------------------------------------------------

/**
 * Produces a stable ID from arbitrary string parts.
 * Used so the same input always produces the same ID.
 */
function deterministicId(prefix: string, ...parts: string[]): string {
  const content = parts.join('::');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    hash = (Math.imul(31, hash) + c) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${prefix}_${hex}`;
}

// ---------------------------------------------------------------------------
// InterviewStructureParser
// ---------------------------------------------------------------------------

export class InterviewStructureParser implements IStructureParser {
  /**
   * Maximum number of lines from the start of the document to scan
   * for metadata fields (Participant:, Role:, etc.).
   */
  private static readonly METADATA_SCAN_DEPTH = 40;

  // ---------------------------------------------------------------------------
  // IStructureParser: parseDocument
  // ---------------------------------------------------------------------------

  parseDocument(raw: IRawParseResult, sourceId: string, fileName: string): DiscoveryDocument {
    const diag = new DiagnosticsCollector();

    const pages: DiscoveryPage[] = raw.pages.map((rawPage) => {
      const blocks = this.classifyPageBlocks(rawPage.text, rawPage.pageNumber);

      const isEmpty = rawPage.text.trim().length === 0;
      if (isEmpty) {
        diag.info(DiagnosticCode.EMPTY_PAGE, `Page ${rawPage.pageNumber} is empty.`, {
          pageNumber: rawPage.pageNumber,
        });
      }

      return {
        pageNumber: rawPage.pageNumber,
        text: rawPage.text,
        blocks,
        isEmpty,
      };
    });

    const metadata = this.extractDocumentMetadata(raw);

    return {
      sourceId,
      sourceType: this.detectSourceType(fileName),
      fileName,
      pageCount: raw.totalPages,
      metadata,
      pages,
      diagnostics: diag.getAll(),
    };
  }

  // ---------------------------------------------------------------------------
  // IStructureParser: parseInterview
  // ---------------------------------------------------------------------------

  parseInterview(document: DiscoveryDocument): DiscoveryInterview {
    const diag = new DiagnosticsCollector();

    // Build a flat list of lines tagged with their page of origin.
    const allLines = this.buildTaggedLines(document);

    // First pass: classify each line.
    const classified = this.classifyLines(allLines);

    // Second pass: extract interview metadata from the document header.
    const { rawMetadata, metadataLineCount } = this.extractInterviewMetadata(classified);

    // Validate participant presence.
    if (!rawMetadata['participant']) {
      diag.warn(DiagnosticCode.MISSING_PARTICIPANT, 'Could not detect participant name in document header. Set to "Unknown".', {
        context: 'Check that the document has a "Participant:" or "Name:" header field.',
      });
    }
    if (!rawMetadata['interviewDate']) {
      diag.warn(DiagnosticCode.MISSING_INTERVIEW_DATE, 'Could not detect interview date in document header.');
    }
    if (!rawMetadata['interviewer']) {
      diag.warn(DiagnosticCode.MISSING_INTERVIEWER, 'Could not detect interviewer name in document header.');
    }

    // Third pass: extract sections and questions from the body lines.
    const contentLines = classified.slice(metadataLineCount);
    const sections = this.extractSections(contentLines, document.sourceId, diag);

    if (sections.length === 0) {
      diag.warn(DiagnosticCode.NO_STRUCTURE_DETECTED, 'No sections or questions detected in document. Document content is preserved in a single unstructured section.');
    }

    // Count total questions and flag empty answers.
    let totalQuestions = 0;
    const seenQuestionTexts = new Set<string>();

    for (const section of sections) {
      for (const q of section.questions) {
        totalQuestions++;

        if (!q.answer.trim()) {
          diag.warn(DiagnosticCode.EMPTY_ANSWER, `Question "${q.question.slice(0, 60)}..." has an empty answer.`, {
            questionId: q.id,
            sectionTitle: section.title,
            pageNumber: q.page,
          });
        }

        const normalizedQuestion = q.question.toLowerCase().trim();
        if (seenQuestionTexts.has(normalizedQuestion)) {
          diag.warn(DiagnosticCode.DUPLICATE_QUESTION, `Duplicate question detected: "${q.question.slice(0, 60)}..."`, {
            questionId: q.id,
            sectionTitle: section.title,
          });
        }
        seenQuestionTexts.add(normalizedQuestion);
      }
    }

    const interviewId = deterministicId(
      'interview',
      document.sourceId,
      rawMetadata['participant'] ?? 'unknown',
      rawMetadata['interviewDate'] ?? '',
    );

    return {
      interviewId,
      participant: rawMetadata['participant'] ?? 'Unknown',
      role: rawMetadata['role'] ?? '',
      department: rawMetadata['department'] ?? '',
      interviewDate: rawMetadata['interviewDate'] ?? '',
      interviewer: rawMetadata['interviewer'] ?? '',
      sourceId: document.sourceId,
      sections,
      rawMetadata,
      diagnostics: diag.getAll(),
    };
  }

  // ---------------------------------------------------------------------------
  // Block classification (for DiscoveryDocument pages)
  // ---------------------------------------------------------------------------

  private classifyPageBlocks(pageText: string, pageNumber: number): DiscoveryBlock[] {
    const lines = pageText.split('\n');
    const blocks: DiscoveryBlock[] = [];

    // Group consecutive non-blank lines into paragraph blocks.
    let buffer: string[] = [];
    let bufferStart = 0;

    const flushBuffer = (endIndex: number) => {
      if (buffer.length === 0) return;
      const raw = buffer.join('\n');
      const text = raw.trim();
      const type = this.classifyBlockText(text);
      blocks.push({
        type,
        text,
        raw,
        pageNumber,
        blockIndex: blocks.length,
        lineStart: bufferStart,
        lineEnd: endIndex - 1,
      });
      buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        flushBuffer(i);
        if (buffer.length === 0) {
          // Record blank block only once per run of blank lines.
          blocks.push({
            type: 'blank',
            text: '',
            raw: '',
            pageNumber,
            blockIndex: blocks.length,
            lineStart: i,
            lineEnd: i,
          });
        }
      } else {
        if (buffer.length === 0) {
          bufferStart = i;
        }
        buffer.push(line);
      }
    }
    flushBuffer(lines.length);

    return blocks;
  }

  private classifyBlockText(text: string): DiscoveryBlockType {
    const firstLine = text.split('\n')[0].trim();

    if (!firstLine) return 'blank';
    if (this.isMetadataLine(firstLine)) return 'metadata';
    if (this.isSectionHeader(firstLine)) return 'section_header';
    if (this.isQuestionMarker(firstLine)) return 'question';
    if (looksLikeQuestion(firstLine) && text.split('\n').length === 1) return 'question';
    if (firstLine.length < 80 && this.isSectionHeader(firstLine)) return 'heading';

    return 'paragraph';
  }

  // ---------------------------------------------------------------------------
  // Tagged line construction
  // ---------------------------------------------------------------------------

  private buildTaggedLines(document: DiscoveryDocument): TaggedLine[] {
    const result: TaggedLine[] = [];
    let globalIndex = 0;

    for (const page of document.pages) {
      const lines = page.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        result.push({
          text: lines[i],
          trimmed: lines[i].trim(),
          pageNumber: page.pageNumber,
          lineIndexOnPage: i,
          globalLineIndex: globalIndex++,
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Line classification
  // ---------------------------------------------------------------------------

  private classifyLines(lines: TaggedLine[]): ClassifiedLine[] {
    return lines.map((line) => {
      if (!line.trimmed) {
        return { ...line, tag: 'blank' as LineTag };
      }

      const metadataMatch = this.matchMetadata(line.trimmed);
      if (metadataMatch) {
        return {
          ...line,
          tag: 'metadata' as LineTag,
          metadataKey: metadataMatch.key,
          metadataValue: metadataMatch.value,
        };
      }

      if (this.isSectionHeader(line.trimmed)) {
        return { ...line, tag: 'section_header' as LineTag };
      }

      if (this.isQuestionMarker(line.trimmed)) {
        return { ...line, tag: 'question_marker' as LineTag };
      }

      return { ...line, tag: 'content' as LineTag };
    });
  }

  // ---------------------------------------------------------------------------
  // Interview metadata extraction
  // ---------------------------------------------------------------------------

  private extractInterviewMetadata(lines: ClassifiedLine[]): {
    rawMetadata: Record<string, string>;
    metadataLineCount: number;
  } {
    const rawMetadata: Record<string, string> = {};
    let lastMetadataIndex = -1;

    const scanDepth = Math.min(lines.length, InterviewStructureParser.METADATA_SCAN_DEPTH);

    for (let i = 0; i < scanDepth; i++) {
      const line = lines[i];
      if (line.tag === 'metadata' && line.metadataKey && line.metadataValue) {
        rawMetadata[line.metadataKey] = line.metadataValue.trim();
        lastMetadataIndex = i;
      } else if (line.tag === 'section_header' || line.tag === 'question_marker') {
        // Stop scanning for metadata once structured content starts.
        break;
      }
    }

    return {
      rawMetadata,
      metadataLineCount: lastMetadataIndex + 1,
    };
  }

  // ---------------------------------------------------------------------------
  // Section and question extraction
  // ---------------------------------------------------------------------------

  private extractSections(
    lines: ClassifiedLine[],
    sourceId: string,
    diag: DiagnosticsCollector,
  ): DiscoverySection[] {
    const sections: DiscoverySection[] = [];

    // If there's no content, return empty.
    if (lines.length === 0) return sections;

    // State machine
    type ParseState = 'seeking' | 'in_question' | 'in_answer';

    let state: ParseState = 'seeking';
    let currentSectionTitle = 'General';
    let currentSectionOrder = 1;
    let currentSectionStartPage = lines[0]?.pageNumber ?? 1;
    let currentSectionQuestions: DiscoveryQuestion[] = [];
    let questionOrder = 0;

    let currentQuestion: QuestionAccumulator | null = null;

    const flushQuestion = () => {
      if (!currentQuestion) return;

      const questionText = currentQuestion.questionLines.join(' ').trim();
      const answerText = currentQuestion.answerLines.join('\n').trim();

      if (!questionText) {
        diag.warn(DiagnosticCode.QUESTION_EXTRACTION_FAILED, 'Accumulated an empty question text — skipping.', {
          sectionTitle: currentSectionTitle,
        });
        currentQuestion = null;
        return;
      }

      currentSectionQuestions.push({
        id: currentQuestion.id,
        question: questionText,
        answer: answerText,
        rawQuestion: currentQuestion.questionLines.join('\n'),
        rawAnswer: currentQuestion.answerLines.join('\n'),
        page: currentQuestion.startPage,
        order: currentQuestion.order,
        answerPages: Array.from(currentQuestion.answerPages),
      });

      currentQuestion = null;
    };

    const flushSection = () => {
      sections.push({
        title: currentSectionTitle,
        order: currentSectionOrder,
        startPage: currentSectionStartPage,
        questions: currentSectionQuestions,
      });
      currentSectionQuestions = [];
    };

    const startNewSection = (title: string, pageNumber: number) => {
      flushQuestion();
      flushSection();
      currentSectionTitle = title;
      currentSectionOrder = sections.length + 1;
      currentSectionStartPage = pageNumber;
      questionOrder = 0;
      state = 'seeking';
    };

    const startNewQuestion = (line: ClassifiedLine) => {
      flushQuestion();

      questionOrder++;
      const qText = this.stripQuestionMarker(line.trimmed);

      currentQuestion = {
        id: deterministicId('q', sourceId, currentSectionTitle, String(questionOrder), qText),
        order: questionOrder,
        questionLines: [qText],
        answerLines: [],
        startPage: line.pageNumber,
        answerPages: new Set([line.pageNumber]),
      };

      // If the question line also contains an inline answer (after a "?"), split it.
      const qMarkIndex = qText.indexOf('?');
      if (qMarkIndex !== -1 && qMarkIndex < qText.length - 1) {
        const inlineAnswer = qText.slice(qMarkIndex + 1).trim();
        if (inlineAnswer.length > 3) {
          currentQuestion.questionLines = [qText.slice(0, qMarkIndex + 1)];
          currentQuestion.answerLines = [inlineAnswer];
          state = 'in_answer';
          return;
        }
      }

      // If the question text already ends with '?', transition immediately
      // to answer collection — the next content lines are the answer.
      if (this.questionTextIsComplete(qText)) {
        state = 'in_answer';
      } else {
        state = 'in_question';
      }
    };

    // Main parsing loop
    for (const line of lines) {
      switch (line.tag) {
        case 'blank':
          // Blank lines transition from question to answer collection.
          if (state === 'in_question' && currentQuestion) {
            state = 'in_answer';
          }
          // Blank lines within answers are preserved.
          if (state === 'in_answer' && currentQuestion) {
            currentQuestion.answerLines.push('');
          }
          break;

        case 'section_header':
          startNewSection(line.trimmed, line.pageNumber);
          break;

        case 'question_marker':
          startNewQuestion(line);
          break;

        case 'content':
          if (state === 'seeking') {
            // Content before any question — check if it looks like a standalone question.
            if (looksLikeQuestion(line.trimmed)) {
              startNewQuestion(line);
            } else {
              // Preamble content — treat as part of section intro, not a question.
            }
          } else if (state === 'in_question' && currentQuestion) {
            // Multi-line question continuation.
            const combined = [...currentQuestion.questionLines, line.trimmed].join(' ');
            currentQuestion.questionLines.push(line.trimmed);
            currentQuestion.answerPages.add(line.pageNumber);
            // Once the accumulated question text is complete, switch to answer mode.
            if (this.questionTextIsComplete(combined)) {
              state = 'in_answer';
            }
          } else if (state === 'in_answer' && currentQuestion) {
            currentQuestion.answerLines.push(line.text);
            currentQuestion.answerPages.add(line.pageNumber);
          }
          break;

        case 'metadata':
          // Metadata appearing in the body (after the header) is treated as content.
          if (state === 'in_answer' && currentQuestion) {
            currentQuestion.answerLines.push(line.text);
          }
          break;
      }
    }

    // Flush remaining state.
    flushQuestion();
    flushSection();

    // If no questions were found in any section, add a fallback unstructured section.
    const hasAnyQuestion = sections.some((s) => s.questions.length > 0);
    if (!hasAnyQuestion && lines.length > 0) {
      const allContent = lines
        .filter((l) => l.tag !== 'blank')
        .map((l) => l.text)
        .join('\n')
        .trim();

      if (allContent) {
        diag.warn(
          DiagnosticCode.NO_STRUCTURE_DETECTED,
          'No question/answer structure detected. All content placed in unstructured section.',
        );

        return [
          {
            title: 'Unstructured Content',
            order: 1,
            startPage: lines[0]?.pageNumber ?? 1,
            questions: [
              {
                id: deterministicId('q', sourceId, 'unstructured', '1'),
                question: '[No question structure detected]',
                answer: allContent,
                rawQuestion: '',
                rawAnswer: allContent,
                page: lines[0]?.pageNumber ?? 1,
                order: 1,
                answerPages: [...new Set(lines.map((l) => l.pageNumber))],
              },
            ],
          },
        ];
      }
    }

    return sections.filter((s) => s.questions.length > 0 || s.title !== 'General');
  }

  // ---------------------------------------------------------------------------
  // Pattern matching helpers
  // ---------------------------------------------------------------------------

  private isMetadataLine(text: string): boolean {
    return METADATA_PATTERNS.some((p) => p.pattern.test(text));
  }

  private matchMetadata(text: string): { key: string; value: string } | null {
    for (const { key, pattern } of METADATA_PATTERNS) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        return { key, value: match[1] };
      }
    }
    return null;
  }

  private isSectionHeader(text: string): boolean {
    if (text.length > 120) return false;
    if (text.endsWith('?')) return false;
    if (SECTION_HEADER_PATTERNS.some((p) => p.test(text))) return true;
    if (ALL_CAPS_HEADING_PATTERN.test(text) && text.split(' ').length >= 2) return true;
    return false;
  }

  private isQuestionMarker(text: string): boolean {
    if (QUESTION_MARKER_PATTERNS.some((p) => p.test(text))) return true;
    if (looksLikeQuestion(text)) return true;
    return false;
  }

  /**
   * Returns true when the accumulated question text appears to be complete
   * (i.e., ends with a question mark, period, or exclamation point), signalling
   * that subsequent content lines belong to the answer, not the question.
   */
  private questionTextIsComplete(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.endsWith('?') || trimmed.endsWith('.') || trimmed.endsWith('!');
  }

  /**
   * Remove the leading question marker (Q1:, 1., Q1., etc.) from a line,
   * returning the clean question text. Never modifies the answer portion.
   */
  private stripQuestionMarker(text: string): string {
    // Remove Q1: Q1. Q1) Q 1.
    let stripped = text.replace(/^Q\.?\s*\d+\s*[:.)\s]\s*/i, '');
    // Remove 1. 1) 1:
    stripped = stripped.replace(/^\d{1,2}\s*[.):\s]\s*/, '');
    // Remove "Question N:"
    stripped = stripped.replace(/^(?:question|QUESTION)\s+\d+\s*[:.]\s*/i, '');

    return stripped.trim() || text.trim();
  }

  // ---------------------------------------------------------------------------
  // Document metadata extraction
  // ---------------------------------------------------------------------------

  private extractDocumentMetadata(raw: IRawParseResult): DiscoveryMetadata {
    const info = raw.metadata as Record<string, unknown>;

    const str = (key: string): string | undefined => {
      const v = info[key];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };

    return {
      title: str('Title'),
      author: str('Author'),
      subject: str('Subject'),
      keywords: str('Keywords'),
      creator: str('Creator'),
      producer: str('Producer'),
      createdAt: str('CreationDate'),
      modifiedAt: str('ModDate'),
      pageCount: raw.totalPages,
      raw: { ...info },
    };
  }

  private detectSourceType(fileName: string): DiscoverySourceType {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
    return 'unknown';
  }
}
