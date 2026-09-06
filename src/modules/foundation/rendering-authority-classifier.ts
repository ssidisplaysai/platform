export type RenderingAuthorityClassification =
  | "POST_CONTENT_DIRECT"
  | "ELEMENTOR_DOCUMENT"
  | "MULTI_AUTHORITY"
  | "OTHER_NAMED_AUTHORITY"
  | "UNRESOLVED";

export function classifyRenderingAuthority(input: {
  postContent: string;
  renderedContent: string;
  publicHtml: string;
  elementorData: string | null;
  elementorEditMode: string | null;
}): RenderingAuthorityClassification {
  const hasElementor = Boolean(input.elementorData?.trim()) && input.elementorEditMode === "builder";
  const publicContainsRendered = Boolean(input.renderedContent) && input.publicHtml.includes(input.renderedContent);
  const publicContainsRaw = Boolean(input.postContent) && input.publicHtml.includes(input.postContent);
  const renderedText = semanticText(input.renderedContent);
  const publicContainsRenderedSemantics = renderedText.length >= 80 && semanticText(input.publicHtml).includes(renderedText);
  if (hasElementor && publicContainsRendered) return "MULTI_AUTHORITY";
  if (hasElementor) return "ELEMENTOR_DOCUMENT";
  if (publicContainsRaw || publicContainsRendered || publicContainsRenderedSemantics) return "POST_CONTENT_DIRECT";
  return "UNRESOLVED";
}

function semanticText(value: string): string {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|#160);/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}
export function requireOperativeAuthorityMutation(input: {
  classification: RenderingAuthorityClassification;
  postContentChanged: boolean;
  elementorDocumentChanged: boolean;
  publicContentChanged: boolean;
}): void {
  if (
    (input.classification === "ELEMENTOR_DOCUMENT" || input.classification === "MULTI_AUTHORITY")
    && input.postContentChanged
    && !input.elementorDocumentChanged
    && !input.publicContentChanged
  ) {
    throw new Error("Remediation changed only the post_content shadow while Elementor rendering authority remained unchanged.");
  }
}