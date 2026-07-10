/**
 * Genesis Discovery Engine — JSON Discovery Exporter
 *
 * Serializes DiscoveryDocument, DiscoveryInterview, and DiscoveryImportResult
 * to formatted JSON.
 *
 * Output is deterministic and lossless — every field is included,
 * in a stable key order. No content is summarized or omitted.
 */

import type {
  DiscoveryDocument,
  DiscoveryImportResult,
  DiscoveryInterview,
} from '../models';
import type { ExporterOutput, IDiscoveryExporter } from './IDiscoveryExporter';

export class JsonDiscoveryExporter implements IDiscoveryExporter {
  readonly name = 'JSON Discovery Exporter v1';

  private readonly indent: number;

  constructor(indent = 2) {
    this.indent = indent;
  }

  // ---------------------------------------------------------------------------
  // IDiscoveryExporter
  // ---------------------------------------------------------------------------

  exportDocument(document: DiscoveryDocument): ExporterOutput {
    const baseName = this.baseName(document.fileName, 'document');
    return {
      content: JSON.stringify(this.serializeDocument(document), null, this.indent),
      extension: 'json',
      mimeType: 'application/json',
      suggestedFileName: baseName,
    };
  }

  exportInterview(interview: DiscoveryInterview): ExporterOutput {
    const baseName = this.baseName(interview.participant, 'interview');
    return {
      content: JSON.stringify(this.serializeInterview(interview), null, this.indent),
      extension: 'json',
      mimeType: 'application/json',
      suggestedFileName: baseName,
    };
  }

  exportResult(result: DiscoveryImportResult): ExporterOutput {
    const participant = result.interview?.participant ?? result.source.fileName;
    const baseName = this.baseName(participant, 'import-result');
    return {
      content: JSON.stringify(this.serializeResult(result), null, this.indent),
      extension: 'json',
      mimeType: 'application/json',
      suggestedFileName: baseName,
    };
  }

  // ---------------------------------------------------------------------------
  // Serializers — maintain stable key order for deterministic output
  // ---------------------------------------------------------------------------

  private serializeDocument(doc: DiscoveryDocument): object {
    return {
      sourceId: doc.sourceId,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      pageCount: doc.pageCount,
      metadata: {
        title: doc.metadata.title ?? null,
        author: doc.metadata.author ?? null,
        subject: doc.metadata.subject ?? null,
        keywords: doc.metadata.keywords ?? null,
        creator: doc.metadata.creator ?? null,
        producer: doc.metadata.producer ?? null,
        createdAt: doc.metadata.createdAt ?? null,
        modifiedAt: doc.metadata.modifiedAt ?? null,
        pageCount: doc.metadata.pageCount,
        raw: doc.metadata.raw,
      },
      pages: doc.pages.map((page) => ({
        pageNumber: page.pageNumber,
        isEmpty: page.isEmpty,
        text: page.text,
        blocks: page.blocks.map((block) => ({
          type: block.type,
          text: block.text,
          raw: block.raw,
          pageNumber: block.pageNumber,
          blockIndex: block.blockIndex,
          lineStart: block.lineStart ?? null,
          lineEnd: block.lineEnd ?? null,
        })),
      })),
      diagnostics: doc.diagnostics,
    };
  }

  private serializeInterview(iv: DiscoveryInterview): object {
    return {
      interviewId: iv.interviewId,
      participant: iv.participant,
      role: iv.role,
      department: iv.department,
      interviewDate: iv.interviewDate,
      interviewer: iv.interviewer,
      sourceId: iv.sourceId,
      rawMetadata: iv.rawMetadata,
      sections: iv.sections.map((section) => ({
        title: section.title,
        order: section.order,
        startPage: section.startPage,
        questions: section.questions.map((q) => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          rawQuestion: q.rawQuestion,
          rawAnswer: q.rawAnswer,
          page: q.page,
          order: q.order,
          answerPages: q.answerPages,
        })),
      })),
      diagnostics: iv.diagnostics,
    };
  }

  private serializeResult(result: DiscoveryImportResult): object {
    return {
      success: result.success,
      timestamp: result.timestamp,
      source: {
        sourceId: result.source.sourceId,
        sourceType: result.source.sourceType,
        fileName: result.source.fileName,
        filePath: result.source.filePath,
        fileSize: result.source.fileSize,
        mimeType: result.source.mimeType,
        importedAt: result.source.importedAt,
      },
      validation: {
        valid: result.validation.valid,
        errorCount: result.validation.errors.length,
        warningCount: result.validation.warnings.length,
        infoCount: result.validation.infos.length,
        errors: result.validation.errors,
        warnings: result.validation.warnings,
        infos: result.validation.infos,
      },
      document: result.document ? this.serializeDocument(result.document) : null,
      interview: result.interview ? this.serializeInterview(result.interview) : null,
      diagnostics: result.diagnostics,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private baseName(hint: string, type: string): string {
    const sanitized = hint
      .replace(/\.[^.]+$/, '')           // strip extension
      .replace(/[^a-zA-Z0-9_\-\s]/g, '') // strip special chars
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60);
    return `discovery-${type}-${sanitized}`;
  }
}
