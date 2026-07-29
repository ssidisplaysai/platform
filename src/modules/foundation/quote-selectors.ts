import type { QuoteListFilters, QuoteRecord, QuoteSearchFilters, QuoteSearchResult } from "./quote-types";

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function filterQuotes(
  quotes: readonly QuoteRecord[],
  filters: QuoteListFilters = {},
): readonly QuoteRecord[] {
  return quotes.filter((quote) => {
    if (filters.organizationId && quote.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteReference && quote.siteReference !== filters.siteReference) {
      return false;
    }

    if (filters.customerReference && quote.customerReference !== filters.customerReference) {
      return false;
    }

    if (filters.commercialStatus && quote.commercialStatus !== filters.commercialStatus) {
      return false;
    }

    if (filters.ownerReference && quote.ownerReference !== filters.ownerReference) {
      return false;
    }

    if (filters.query) {
      const q = normalized(filters.query);
      const lineText = quote.lines
        .map((line) => `${line.sku} ${line.productId} ${line.displayName}`)
        .join(" ")
        .toLowerCase();
      const candidate = `${quote.quoteNumber} ${quote.customerReference} ${quote.primaryContactReference ?? ""} ${quote.ownerReference} ${lineText}`.toLowerCase();
      if (!candidate.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function searchQuotes(
  quotes: readonly QuoteRecord[],
  filters: QuoteSearchFilters,
): readonly QuoteSearchResult[] {
  const q = normalized(filters.query);

  return quotes
    .filter((quote) => {
      if (filters.organizationId && quote.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && quote.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((quote) => {
      const matchedFields: string[] = [];

      if (normalized(quote.quoteNumber).includes(q)) {
        matchedFields.push("quoteNumber");
      }
      if (normalized(quote.customerReference).includes(q)) {
        matchedFields.push("customer");
      }
      if (quote.primaryContactReference && normalized(quote.primaryContactReference).includes(q)) {
        matchedFields.push("contact");
      }
      if (normalized(quote.ownerReference).includes(q)) {
        matchedFields.push("owner");
      }
      if (normalized(quote.commercialStatus).includes(q)) {
        matchedFields.push("status");
      }
      if (String(quote.revision).includes(q)) {
        matchedFields.push("revision");
      }
      if (normalized(quote.createdAt).includes(q) || normalized(quote.updatedAt).includes(q)) {
        matchedFields.push("date");
      }

      quote.lines.forEach((line) => {
        if (normalized(line.sku).includes(q)) {
          matchedFields.push("sku");
        }
        if (normalized(line.productId).includes(q) || normalized(line.displayName).includes(q)) {
          matchedFields.push("product");
        }
      });

      quote.revisionHistory.forEach((revision) => {
        if (normalized(revision.reason).includes(q)) {
          matchedFields.push("revision");
        }
      });

      return {
        quoteId: quote.documentId,
        quoteNumber: quote.quoteNumber,
        customerReference: quote.customerReference,
        ownerReference: quote.ownerReference,
        revision: quote.revision,
        commercialStatus: quote.commercialStatus,
        approvalStatus: quote.approvalStatus,
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .filter((result) => result.matchedFields.length > 0);
}
