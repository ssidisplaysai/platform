import { createHash } from "node:crypto";
import type { AuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";

export type GlwReferenceParentCandidate = {
  objectId: number;
  postType: string;
  title: string;
  slug: string;
  status: string;
  parentId: number;
  permalink: string;
  featuredImageId: number | null;
  canonicalUrl: string | null;
  contentSha256: string;
  contentWordCount: number;
  productIdentity: "EXACT" | "EQUIVALENT" | "UNRELATED";
};
export type GlwReferenceParentInventory = {
  complete: boolean;
  fingerprint: string;
  exactSlugMatches: readonly GlwReferenceParentCandidate[];
  exactTitleMatches: readonly GlwReferenceParentCandidate[];
  equivalentMatches: readonly GlwReferenceParentCandidate[];
  plausibleCandidates: readonly GlwReferenceParentCandidate[];
  failedReads: readonly string[];
  classification: "EXISTING_EXACT_PARENT" | "EXISTING_EQUIVALENT_PARENT_REQUIRES_RECONCILIATION" | "MISSING_PARENT_REQUIRES_CREATION" | "PRODUCT_AUTHORITY_CONFLICT" | "AMBIGUOUS";
};
const STATUSES = ["publish", "draft", "private", "pending", "future", "trash"] as const;
const ENDPOINTS = ["pages", "posts", "product"] as const;
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown): string { if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); const object = record(value); return object ? text(object.raw) || text(object.rendered) : ""; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function classify(title: string, slug: string, content: string): GlwReferenceParentCandidate["productIdentity"] {
  if (/^outdoor (?:digital|led) sphere$/i.test(title) || /^(?:outdoor-digital-sphere|outdoor-led-sphere)$/i.test(slug)) return "EXACT";
  const combined = `${title} ${slug.replaceAll("-", " ")} ${content}`;
  if (/\boutdoor (?:digital|led) sphere\b/i.test(combined) && !/\bindoor digital sphere\b/i.test(title)) return "EQUIVALENT";
  return "UNRELATED";
}
export async function inspectGlwReferenceParentInventory(reader: AuthenticatedWordPressReadAuthority): Promise<GlwReferenceParentInventory> {
  const candidates = new Map<string, GlwReferenceParentCandidate>();
  const failedReads: string[] = [];
  for (const endpoint of ENDPOINTS) {
    for (const status of STATUSES) {
      const queries = [
        new URLSearchParams({ search: "Sphere", status, context: "edit", per_page: "100", _fields: "id,type,slug,status,parent,link,title,content,featured_media,yoast_head_json" }),
        new URLSearchParams({ slug: "outdoor-digital-sphere", status, context: "edit", per_page: "100", _fields: "id,type,slug,status,parent,link,title,content,featured_media,yoast_head_json" }),
        new URLSearchParams({ slug: "outdoor-led-sphere", status, context: "edit", per_page: "100", _fields: "id,type,slug,status,parent,link,title,content,featured_media,yoast_head_json" }),
      ];
      for (const [index, query] of queries.entries()) {
        const response = await reader.getJson({ path: `/${endpoint}`, query });
        if (!response.ok || !Array.isArray(response.body)) { failedReads.push(`${endpoint}:${status}:${index}`); continue; }
        for (const value of response.body) {
          const item = record(value), objectId = Number(item?.id);
          if (!item || !Number.isSafeInteger(objectId) || objectId <= 0) continue;
          const title = text(item.title), slug = text(item.slug), content = text(item.content), yoast = record(item.yoast_head_json);
          const candidate: GlwReferenceParentCandidate = { objectId, postType: text(item.type) || endpoint, title, slug, status: text(item.status), parentId: Number(item.parent ?? 0), permalink: text(item.link), featuredImageId: Number(item.featured_media ?? 0) || null, canonicalUrl: text(yoast?.canonical) || null, contentSha256: sha256(content), contentWordCount: content ? content.split(/\s+/).length : 0, productIdentity: classify(title, slug, content) };
          candidates.set(`${endpoint}:${objectId}`, candidate);
        }
      }
    }
  }
  const all = [...candidates.values()].sort((left, right) => left.postType.localeCompare(right.postType) || left.objectId - right.objectId);
  const exactSlugMatches = all.filter((candidate) => candidate.slug === "outdoor-digital-sphere" && candidate.parentId === 0);
  const exactTitleMatches = all.filter((candidate) => /^outdoor digital sphere$/i.test(candidate.title));
  const equivalentMatches = all.filter((candidate) => candidate.productIdentity === "EQUIVALENT");
  const plausibleCandidates = all.filter((candidate) => candidate.productIdentity !== "UNRELATED");
  const classification = failedReads.length
    ? "AMBIGUOUS"
    : exactSlugMatches.length === 1 && exactSlugMatches[0].postType === "page"
      ? "EXISTING_EXACT_PARENT"
      : exactSlugMatches.length > 1
        ? "AMBIGUOUS"
        : equivalentMatches.length === 1
          ? "EXISTING_EQUIVALENT_PARENT_REQUIRES_RECONCILIATION"
          : equivalentMatches.length > 1
            ? "AMBIGUOUS"
            : exactTitleMatches.length > 0
              ? "PRODUCT_AUTHORITY_CONFLICT"
              : "MISSING_PARENT_REQUIRES_CREATION";
  const fingerprint = sha256(JSON.stringify({ exactSlugMatches, exactTitleMatches, equivalentMatches, plausibleCandidates, failedReads }));
  return { complete: failedReads.length === 0, fingerprint, exactSlugMatches, exactTitleMatches, equivalentMatches, plausibleCandidates, failedReads, classification };
}
