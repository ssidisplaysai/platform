import type { GlwPageExecutionRecord } from "@/modules/glw/page-execution";

export type ExactJobWordPressPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
  featured_media?: number;
  title?: { raw?: string };
  excerpt?: { raw?: string };
  content?: { raw?: string };
  meta?: Record<string, unknown>;
};

export function proposedExactJobSeo(job: GlwPageExecutionRecord) {
  return {
    focusKeyphrase: job.focusKeyphrase?.trim() ?? "",
    seoTitle: job.seoTitle.trim(),
    metaDescription: job.metaDescription.trim(),
  };
}

export function verifyExactJobPage(input: {
  page: ExactJobWordPressPage;
  expectedObjectId: string;
  expectedSlug: string;
  expectedParentId: string;
  expectedStatus: "draft" | "publish";
}): boolean {
  return String(input.page.id ?? "") === input.expectedObjectId
    && input.page.slug === input.expectedSlug
    && String(input.page.parent ?? "") === input.expectedParentId
    && input.page.status === input.expectedStatus;
}

export function contentVerification(contentHtml: string) {
  const text = contentHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  const encodingMarkers = text.match(/[ÃÂâ\uFFFD]/g) ?? [];
  return {
    wordCount: text ? text.split(/\s+/).length : 0,
    encodingMarkerCount: encodingMarkers.length,
    ready: Boolean(text) && encodingMarkers.length === 0,
  };
}