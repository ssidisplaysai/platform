export type RenderingAuthorityClassification =
  | "POST_CONTENT_DIRECT"
  | "ELEMENTOR_DOCUMENT"
  | "MULTI_AUTHORITY"
  | "UNKNOWN";

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
  if (hasElementor && publicContainsRendered) return "MULTI_AUTHORITY";
  if (hasElementor) return "ELEMENTOR_DOCUMENT";
  if (publicContainsRaw || publicContainsRendered) return "POST_CONTENT_DIRECT";
  return "UNKNOWN";
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