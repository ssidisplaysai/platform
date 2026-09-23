export function glwContentOwnsPrimaryHero(contentHtml: string): boolean {
  const html = contentHtml.trim();
  if (!html) return false;

  return /data-reference-section\s*=\s*["']HERO["']/i.test(html)
    || /data-genesis-hero\s*=\s*["']true["']/i.test(html);
}

export function shouldInsertGlwInlineHero(contentHtml: string): boolean {
  return !glwContentOwnsPrimaryHero(contentHtml);
}
