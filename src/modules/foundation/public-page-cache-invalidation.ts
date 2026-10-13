export type PublicPageCacheInvalidationState =
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "CLEARED"
  | "FAILED"
  | "UNAVAILABLE";

export type PublicPageCacheInvalidationResult = {
  state: PublicPageCacheInvalidationState;
  pageId: string;
  url: string;
  authority: string | null;
};

export function requirePublicPageCacheCleared(
  result: PublicPageCacheInvalidationResult,
): void {
  if (result.state === "NOT_REQUIRED" || result.state === "CLEARED") return;
  throw new Error(
    `Public page-cache invalidation must be CLEARED before public acceptance; received ${result.state}.`,
  );
}