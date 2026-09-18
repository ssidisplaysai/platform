import "server-only";

const PAGE_TITLE_SELECTOR = ".page-title.the-title";

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
  return `body.page-id-${wordpressObjectId} ${PAGE_TITLE_SELECTOR}{display:none!important}`;
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
