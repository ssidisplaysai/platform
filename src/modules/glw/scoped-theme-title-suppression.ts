import "server-only";

const PAGE_TITLE_SELECTORS = [
  ".page-title.the-title",
  ".page-header .entry-title",
  ".entry-header .entry-title",
] as const;

const FEATURED_MEDIA_SELECTORS = [
  ".featured-image.page-header-image-single",
  ".page-header-image-single",
  ".entry-header + .featured-image",
  ".entry-header + .post-thumbnail",
  ".inside-article > .featured-image",
  ".inside-article > .post-image",
  "article > .post-thumbnail",
  "article > .featured-image",
  ".single-featured-image-header",
] as const;

function normalizeWordPressObjectId(value: string): string {
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("SCOPED_THEME_TITLE_SUPPRESSION_WORDPRESS_OBJECT_ID_INVALID");
  }
  return normalized;
}

function h1Count(html: string): number {
  return (html.match(/<h1\b/gi) ?? []).length;
}

function scopedRule(wordpressObjectId: string): string {
  return `${PAGE_TITLE_SELECTORS
    .map((selector) => `body.page-id-${wordpressObjectId} ${selector}`)
    .join(",")}{display:none!important}`;
}

function injectRuleIntoFirstStyle(html: string, rule: string): string {
  const styleBlock = /<style\b[^>]*>([\s\S]*?)<\/style>/i;
  if (styleBlock.test(html)) {
    return html.replace(styleBlock, (match) => {
      if (match.includes(rule)) {
        return match;
      }
      return match.replace(/<\/style>/i, `${rule}</style>`);
    });
  }

  return `<!-- wp:html --><style>${rule}</style><!-- /wp:html -->${html}`;
}

export function applyScopedThemeTitleSuppression(input: {
  contentHtml: string;
  wordpressObjectId: string;
}) {
  const source = input.contentHtml.trim();
  const wordpressObjectId = normalizeWordPressObjectId(input.wordpressObjectId);
  const rule = scopedRule(wordpressObjectId);
  const beforeH1 = h1Count(source);
  if (beforeH1 !== 1) {
    throw new Error("SCOPED_THEME_TITLE_SUPPRESSION_H1_CONTRACT_FAILED");
  }

  const alreadySuppressed = source.includes(rule);
  if (alreadySuppressed) {
    return {
      contentHtml: source,
      scopedRule: rule,
      mutated: false as const,
      alreadySuppressed: true as const,
    };
  }

  const updated = injectRuleIntoFirstStyle(source, rule);
  const afterH1 = h1Count(updated);
  if (afterH1 !== 1 || !updated.includes(rule)) {
    throw new Error("SCOPED_THEME_TITLE_SUPPRESSION_TRANSFORM_FAILED");
  }

  return {
    contentHtml: updated,
    scopedRule: rule,
    mutated: true as const,
    alreadySuppressed: false as const,
  };
}


export function applyScopedThemeFeaturedMediaSuppression(input: {
  contentHtml: string;
  wordpressObjectId: string;
}) {
  const source = input.contentHtml.trim();
  const wordpressObjectId = normalizeWordPressObjectId(input.wordpressObjectId);
  const rule = FEATURED_MEDIA_SELECTORS
    .map((selector) => "body.page-id-" + wordpressObjectId + " " + selector)
    .join(",") + "{display:none!important}";
  const beforeH1 = h1Count(source);
  if (beforeH1 !== 1) {
    throw new Error("SCOPED_THEME_FEATURED_MEDIA_SUPPRESSION_H1_CONTRACT_FAILED");
  }

  const alreadySuppressed = source.includes(rule);
  if (alreadySuppressed) {
    return {
      contentHtml: source,
      scopedRule: rule,
      mutated: false as const,
      alreadySuppressed: true as const,
    };
  }

  const updated = injectRuleIntoFirstStyle(source, rule);
  if (h1Count(updated) !== 1 || !updated.includes(rule)) {
    throw new Error("SCOPED_THEME_FEATURED_MEDIA_SUPPRESSION_TRANSFORM_FAILED");
  }

  return {
    contentHtml: updated,
    scopedRule: rule,
    mutated: true as const,
    alreadySuppressed: false as const,
  };
}
