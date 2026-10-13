/**
 * Genesis Discovery Engine — PDF Raw Parser
 *
 * Stage 1 parser for PDF sources.
 *
 * Extracts per-page text and document metadata from a PDF buffer using
 * the installed pdf-parse API. Physical page numbers remain explicit.
 *
 * This parser knows nothing about interview structure.
 * It only turns bytes into lines of text, page by page.
 */

import { PDFParse } from 'pdf-parse';
import type { IRawParser, IRawParseResult, IRawPage } from './IDiscoveryParser';
import type { DiscoverySourceType } from '../models';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PdfRawParser implements IRawParser {
  canParse(sourceType: DiscoverySourceType): boolean {
    return sourceType === 'pdf';
  }

  async parse(buffer: Buffer, fileName: string): Promise<IRawParseResult> {
    const parser = new PDFParse({ data: buffer });

    try {
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();
      const pages: IRawPage[] = textResult.pages.map((page) => ({
        pageNumber: page.num,
        text: page.text,
      }));
      return {
        pages,
        metadata: { ...infoResult.info },
        totalPages: textResult.total,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`PdfRawParser: Failed to parse "${fileName}": ${message}`);
    } finally {
      await parser.destroy();
    }
  }
}
