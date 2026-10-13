import { load } from "cheerio";

const ENVIRONMENTAL_QUESTION = "What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasMeaningfulListContent(text: string): boolean {
  return /[a-z0-9]/i.test(text);
}

function isCanonicalReplacementQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized === ENVIRONMENTAL_QUESTION;
}

function isBadStructuralHeader(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (normalized === ENVIRONMENTAL_QUESTION) return true;
  return /^what\s+[a-z0-9\s,'()-]+\?$/.test(normalized.toLowerCase());
}

function isThemeFeaturedImagePrimaryDomain(siteDomain: string | null | undefined): boolean {
  return (siteDomain ?? "").trim().toLowerCase() === "projectorenclosure.com";
}

export function cleanupCanonicalizedStructure(input: {
  html: string;
  siteDomain?: string | null;
}): {
  html: string;
  removedEmptyListItems: number;
  removedEmptyLists: number;
  removedDuplicateCanonicalQuestions: number;
  removedStructuralColumns: number;
  removedInlineHeroFigures: number;
  whitespaceFixes: number;
} {
  const $ = load(input.html, null, false);

  let removedEmptyListItems = 0;
  let removedEmptyLists = 0;
  let removedDuplicateCanonicalQuestions = 0;
  let removedStructuralColumns = 0;
  let removedInlineHeroFigures = 0;
  let whitespaceFixes = 0;

  if (isThemeFeaturedImagePrimaryDomain(input.siteDomain)) {
    $("figure.page-hero-image").each((_, node) => {
      removedInlineHeroFigures += 1;
      $(node).remove();
    });
  }

  $("li").each((_, node) => {
    const element = $(node);
    const text = normalizeText(element.text());
    const hasMedia = element.find("img,figure,video,svg,canvas,iframe").length > 0;
    const hasLink = element.find("a[href]").length > 0;
    if (!hasMeaningfulListContent(text) && !hasMedia && !hasLink) {
      removedEmptyListItems += 1;
      element.remove();
    }
  });

  $("ul,ol").each((_, list) => {
    const element = $(list);
    const meaningfulItems = element.children("li").filter((__, li) => {
      const candidate = $(li);
      const text = normalizeText(candidate.text());
      const hasMedia = candidate.find("img,figure,video,svg,canvas,iframe").length > 0;
      const hasLink = candidate.find("a[href]").length > 0;
      return hasMeaningfulListContent(text) || hasMedia || hasLink;
    });
    if (meaningfulItems.length === 0) {
      removedEmptyLists += 1;
      element.remove();
    }
  });

  $("li,p").each((_, node) => {
    const element = $(node);
    const current = normalizeText(element.text());
    if (!isCanonicalReplacementQuestion(current)) return;
    const previous = element.prev("li,p");
    if (!previous.length) return;
    const previousText = normalizeText(previous.text());
    if (isCanonicalReplacementQuestion(previousText)) {
      removedDuplicateCanonicalQuestions += 1;
      element.remove();
    }
  });

  $("table").each((_, table) => {
    const tableElement = $(table);
    const headerCells = tableElement.find("thead tr").first().children("th,td").toArray();
    if (headerCells.length === 0) return;

    const removableColumnIndexes = headerCells
      .map((cell, index) => ({ index, text: normalizeText($(cell).text()) }))
      .filter((entry) => isBadStructuralHeader(entry.text))
      .map((entry) => entry.index);

    if (removableColumnIndexes.length === 0) return;

    const uniqueIndexes = [...new Set(removableColumnIndexes)].sort((left, right) => right - left);
    for (const index of uniqueIndexes) {
      tableElement.find("tr").each((__, row) => {
        const cells = $(row).children("th,td");
        const target = cells.eq(index);
        if (target.length) {
          removedStructuralColumns += 1;
          target.remove();
        }
      });
    }

    tableElement.find("tr").each((__, row) => {
      const cells = $(row).children("th,td");
      if (!cells.length) {
        $(row).remove();
        return;
      }
      const anyMeaningful = cells.toArray().some((cell) => hasMeaningfulListContent(normalizeText($(cell).text())));
      if (!anyMeaningful) {
        $(row).remove();
      }
    });

    const remainingHeaders = tableElement.find("thead tr").first().children("th,td").length;
    const remainingBodyRows = tableElement.find("tbody tr").length;
    if (remainingHeaders < 2 || remainingBodyRows === 0) {
      tableElement.remove();
    }
  });

  let htmlOutput = $.html();
  htmlOutput = htmlOutput.replace(/([?.!])(\s*<\/(?:strong|em|b|i|span|a)>\s*)(\p{Lu})/gu, (_full, punctuation: string, closingTag: string, upper: string) => {
    whitespaceFixes += 1;
    return `${punctuation}${closingTag}${upper}`.replace(/(<\/(?:strong|em|b|i|span|a)>)(\p{Lu})/u, "$1 $2");
  });

  htmlOutput = htmlOutput.replace(/([?.!])(<\/strong>)(\p{Lu})/gu, (_full, punctuation: string, closeStrong: string, upper: string) => {
    whitespaceFixes += 1;
    return `${punctuation}${closeStrong} ${upper}`;
  });

  return {
    html: htmlOutput,
    removedEmptyListItems,
    removedEmptyLists,
    removedDuplicateCanonicalQuestions,
    removedStructuralColumns,
    removedInlineHeroFigures,
    whitespaceFixes,
  };
}
