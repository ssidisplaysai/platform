/**
 * Genesis Discovery Engine — Validation Rules
 *
 * Pure validation functions. Each rule checks one concern, returns a
 * diagnostic if violated, or null if the check passes.
 *
 * Rules are grouped by the artifact they check:
 *   - Document rules: check DiscoveryDocument completeness
 *   - Interview rules: check DiscoveryInterview completeness
 *
 * Validation NEVER modifies the artifact — it only observes.
 */

import {
  DiagnosticCode,
  DiscoveryDiagnostic,
  DiscoveryDocument,
  DiscoveryInterview,
} from '../models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ValidationRule<T> = (artifact: T) => DiscoveryDiagnostic | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diag(
  severity: 'error' | 'warning' | 'info',
  code: DiagnosticCode,
  message: string,
  extra?: Partial<DiscoveryDiagnostic>,
): DiscoveryDiagnostic {
  return {
    code,
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Document validation rules
// ---------------------------------------------------------------------------

export const documentRules: Array<ValidationRule<DiscoveryDocument>> = [
  // Source ID must be present.
  (doc) =>
    !doc.sourceId
      ? diag('error', DiagnosticCode.VALIDATION_FAILED, 'DiscoveryDocument is missing sourceId.')
      : null,

  // Must have at least one page.
  (doc) =>
    doc.pages.length === 0
      ? diag('error', DiagnosticCode.DOCUMENT_LOAD_FAILED, 'DiscoveryDocument has no pages.')
      : null,

  // Page count should match pages array length.
  (doc) =>
    doc.pageCount !== doc.pages.length
      ? diag('warning', DiagnosticCode.PAGE_REFERENCE_LOST,
          `DiscoveryDocument.pageCount (${doc.pageCount}) does not match pages array length (${doc.pages.length}).`)
      : null,

  // All pages should have text (warn on empty ones).
  (doc) => {
    const emptyPages = doc.pages.filter((p) => p.isEmpty);
    return emptyPages.length > 0
      ? diag('warning', DiagnosticCode.EMPTY_PAGE,
          `${emptyPages.length} empty page(s) detected: pages ${emptyPages.map((p) => p.pageNumber).join(', ')}.`)
      : null;
  },

  // Metadata should have page count.
  (doc) =>
    doc.metadata.pageCount === 0
      ? diag('warning', DiagnosticCode.MISSING_METADATA, 'DiscoveryDocument metadata has a page count of 0.')
      : null,

  // File name must be present.
  (doc) =>
    !doc.fileName
      ? diag('error', DiagnosticCode.VALIDATION_FAILED, 'DiscoveryDocument is missing fileName.')
      : null,
];

// ---------------------------------------------------------------------------
// Interview validation rules
// ---------------------------------------------------------------------------

export const interviewRules: Array<ValidationRule<DiscoveryInterview>> = [
  // Interview must reference a source.
  (iv) =>
    !iv.sourceId
      ? diag('error', DiagnosticCode.VALIDATION_FAILED, 'DiscoveryInterview is missing sourceId.')
      : null,

  // Participant must be identified.
  (iv) =>
    !iv.participant || iv.participant === 'Unknown'
      ? diag('warning', DiagnosticCode.MISSING_PARTICIPANT,
          'DiscoveryInterview participant is unknown or not detected.')
      : null,

  // Interview date should be present.
  (iv) =>
    !iv.interviewDate
      ? diag('warning', DiagnosticCode.MISSING_INTERVIEW_DATE,
          'DiscoveryInterview is missing an interview date.')
      : null,

  // Interviewer should be present.
  (iv) =>
    !iv.interviewer
      ? diag('warning', DiagnosticCode.MISSING_INTERVIEWER,
          'DiscoveryInterview is missing an interviewer.')
      : null,

  // Must have at least one section.
  (iv) =>
    iv.sections.length === 0
      ? diag('error', DiagnosticCode.MISSING_SECTION,
          'DiscoveryInterview has no sections — no content was extracted.')
      : null,

  // Must have at least one question across all sections.
  (iv) => {
    const total = iv.sections.reduce((sum, s) => sum + s.questions.length, 0);
    return total === 0
      ? diag('warning', DiagnosticCode.QUESTION_EXTRACTION_FAILED,
          'DiscoveryInterview has no extracted questions across any section.')
      : null;
  },

  // Check for questions with empty answers.
  (iv) => {
    const emptyAnswers = iv.sections.flatMap((s) =>
      s.questions.filter((q) => !q.answer.trim()),
    );
    return emptyAnswers.length > 0
      ? diag('warning', DiagnosticCode.EMPTY_ANSWER,
          `${emptyAnswers.length} question(s) have empty answers.`)
      : null;
  },

  // Check for duplicate questions within same interview.
  (iv) => {
    const texts = iv.sections.flatMap((s) =>
      s.questions.map((q) => q.question.toLowerCase().trim()),
    );
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    return dupes.length > 0
      ? diag('warning', DiagnosticCode.DUPLICATE_QUESTION,
          `${dupes.length} duplicate question text(s) detected.`)
      : null;
  },

  // Section order should be sequential starting from 1.
  (iv) => {
    const orders = iv.sections.map((s) => s.order);
    const isSequential = orders.every((o, i) => o === i + 1);
    return !isSequential
      ? diag('info', DiagnosticCode.AMBIGUOUS_STRUCTURE,
          'Section order values are non-sequential — may indicate parsing gaps.')
      : null;
  },
];
