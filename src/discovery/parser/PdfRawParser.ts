/**
 * Genesis Discovery Engine — PDF Raw Parser
 *
 * Stage 1 parser for PDF sources.
 *
 * Extracts per-page text from a PDF buffer using pdf-parse + PDF.js
 * text content. Uses the y-coordinate of each text item to detect
 * line breaks, preserving the visual line structure of the document.
 *
 * This parser knows nothing about interview structure.
 * It only turns bytes into lines of text, page by page.
 */

import pdfParse from 'pdf-parse';
import type { IRawParser, IRawParseResult, IRawPage } from './IDiscoveryParser';
import type { DiscoverySourceType } from '../models';

// ---------------------------------------------------------------------------
// Types for pdf-parse / PDF.js internals
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
  dir: string;
  transform: number[]; // [a, b, c, d, e, f] — transform[5] is y position
  width: number;
  height: number;
  fontName: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPageData {
  getTextContent(options?: { normalizeWhitespace?: boolean }): Promise<PdfTextContent>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PdfRawParser implements IRawParser {
  /** Y-coordinate delta threshold for treating items as on separate lines. */
  private static readonly LINE_BREAK_THRESHOLD = 4;

  canParse(sourceType: DiscoverySourceType): boolean {
    return sourceType === 'pdf';
  }

  async parse(buffer: Buffer, fileName: string): Promise<IRawParseResult> {
    const collectedPages: IRawPage[] = [];

    /**
     * The pagerender closure captures `collectedPages` so each page's text
     * is pushed in order as pdf-parse processes pages sequentially.
     */
    const pagerender = async (pageData: PdfPageData): Promise<string> => {
      const pageNumber = collectedPages.length + 1;
      const text = await PdfRawParser.extractPageText(pageData);
      collectedPages.push({ pageNumber, text });
      return text;
    };

    let pdfResult: { numpages: number; info: Record<string, unknown> };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfResult = await (pdfParse as any)(buffer, { pagerender });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`PdfRawParser: Failed to parse "${fileName}": ${message}`);
    }

    // pdf-parse may skip rendering empty pages. Fill gaps so page numbers
    // remain aligned with the physical document.
    while (collectedPages.length < pdfResult.numpages) {
      collectedPages.push({
        pageNumber: collectedPages.length + 1,
        text: '',
      });
    }

    return {
      pages: collectedPages,
      metadata: (pdfResult.info as Record<string, unknown>) ?? {},
      totalPages: pdfResult.numpages,
    };
  }

  // ---------------------------------------------------------------------------
  // Private static helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a PDF.js page's text content into a plain-text string.
   * Uses Y-coordinate deltas between text items to reconstruct line breaks,
   * preserving the visual line structure of the source page.
   */
  private static async extractPageText(pageData: PdfPageData): Promise<string> {
    let textContent: PdfTextContent;

    try {
      textContent = await pageData.getTextContent({ normalizeWhitespace: false });
    } catch {
      return '';
    }

    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!item.str) continue;

      const y = item.transform[5];

      if (lastY === null) {
        currentLine = item.str;
      } else if (Math.abs(y - lastY) > PdfRawParser.LINE_BREAK_THRESHOLD) {
        // Y position changed significantly — start a new line.
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = item.str;
      } else {
        // Same line — join with a space if neither side already has one.
        const needsSpace =
          currentLine.length > 0 &&
          !currentLine.endsWith(' ') &&
          !item.str.startsWith(' ');
        currentLine += needsSpace ? ' ' + item.str : item.str;
      }

      lastY = y;
    }

    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }
}
