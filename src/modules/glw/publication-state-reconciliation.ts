export type WordPressPublicationPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
};

export type GlwPublicationReconciliationClassification =
  | "RECONCILED_PUBLISHED"
  | "HIERARCHY_MISMATCH"
  | "NOT_PUBLISHED"
  | "UNRESOLVED_ERROR";

export function classifyGlwPublicationRead(input: {
  page: WordPressPublicationPage;
  expectedWordpressObjectId: string;
  expectedSlug: string;
  expectedParentId: string;
}): GlwPublicationReconciliationClassification {
  if (String(input.page.id ?? "") !== input.expectedWordpressObjectId) {
    return "UNRESOLVED_ERROR";
  }

  if (
    input.page.slug !== input.expectedSlug
    || String(input.page.parent ?? "") !== input.expectedParentId
  ) {
    return "HIERARCHY_MISMATCH";
  }

  return input.page.status === "publish"
    ? "RECONCILED_PUBLISHED"
    : "NOT_PUBLISHED";
}