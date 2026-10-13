import "server-only";
import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

export async function writeExactWordPressDraftYoastSearch(input: { site: SiteConfiguration; wordpressObjectId: string; focusKeyphrase: string; seoTitle: string; metaDescription: string }): Promise<{ ok: boolean; state: string }> {
  const credential = resolveWordPressCredentialReference(input.site.integrations.wordpressCredentialReference);
  if (!credential || !input.site.integrations.wordpressApiBaseUrl || input.site.enabled || input.site.publishingStatus !== "disabled") return { ok: false, state: "BOUNDARY" };
  const apiBase = normalizeWordPressApiBaseUrl(input.site.integrations.wordpressApiBaseUrl);
  const authority = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: apiBase, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
  const page = await authority.getJson({ path: `/pages/${input.wordpressObjectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,status" }) });
  if (!page.ok || !page.body || typeof page.body !== "object" || Array.isArray(page.body) || (page.body as { status?: unknown }).status !== "draft") return { ok: false, state: "DRAFT_READ" };
  const authorization = `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`, "utf8").toString("base64")}`;
  try {
    const response = await fetch(`${new URL(apiBase).origin}/wp-json/yoast/v1/bulk_editor/update_search`, { method: "POST", headers: { Accept: "application/json", Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: Number(input.wordpressObjectId), seo_title: input.seoTitle, meta_description: input.metaDescription, focus_keyphrase: input.focusKeyphrase }] }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return { ok: false, state: `HTTP_${response.status}` };
    const body = await response.json() as { results?: Array<{ id?: number; success?: boolean; error?: string }> };
    const result = body.results?.[0];
    return result?.success ? { ok: true, state: "UPDATED" } : { ok: false, state: `RESULT_${result?.error ?? "UNKNOWN"}` };
  } catch { return { ok: false, state: "NETWORK" }; }
}
