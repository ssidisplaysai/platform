import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import type { ContextualMediaRecord, PublishedContextualMediaTransport, PublishedContextualPage } from "./published-contextual-media-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressPage = {
  id?: number;
  slug?: string;
  status?: string;
  parent?: number;
  featured_media?: number;
  title?: { raw?: string };
  content?: { raw?: string };
  yoast_head_json?: { canonical?: string; robots?: Record<string, string> };
};
type WordPressMedia = { id?: number; media_type?: string; source_url?: string; alt_text?: string; guid?: { rendered?: string } };

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}
function extension(value: string): string { return value.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg"; }
function xml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }

export function createPublishedContextualMediaWordPressTransport(site: SiteConfiguration): PublishedContextualMediaTransport | null {
  const reference = site.integrations.wordpressCredentialReference;
  const configuredBase = site.integrations.wordpressApiBaseUrl;
  const credential = resolveWordPressCredentialReference(reference);
  if (!configuredBase || !credential || site.siteId !== "site-ssi-projectorenclosure" || site.domain !== "projectorenclosure.com") return null;
  const apiBase = normalizeWordPressApiBaseUrl(configuredBase);
  const origin = new URL(apiBase).origin;
  const auth = authorization(credential.username, credential.applicationPassword);
  const readHeaders = { Accept: "application/json", Authorization: auth, "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" };
  const uploadedUrls = new Map<number, string>();
  const targetCollections = new Map<number, "pages" | "posts">();

  async function scanRestrictedType(postType: string, mediaId: number, mediaUrl: string): Promise<"CLEAR" | "REFERENCED" | "INCOMPLETE"> {
    for (let offset = 0; offset < 10_000; offset += 100) {
      const payload = `<?xml version="1.0"?><methodCall><methodName>wp.getPosts</methodName><params><param><value><int>0</int></value></param><param><value><string>${xml(credential.username)}</string></value></param><param><value><string>${xml(credential.applicationPassword)}</string></value></param><param><value><struct><member><name>post_type</name><value><string>${xml(postType)}</string></value></member><member><name>post_status</name><value><string>any</string></value></member><member><name>number</name><value><int>100</int></value></member><member><name>offset</name><value><int>${offset}</int></value></member></struct></value></param><param><value><array><data><value><string>post_id</string></value><value><string>post_content</string></value><value><string>post_thumbnail</string></value><value><string>custom_fields</string></value></data></array></value></param></params></methodCall>`;
      const response = await fetch(`${origin}/xmlrpc.php`, { method: "POST", headers: { "Content-Type": "text/xml" }, body: payload, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return "INCOMPLETE";
      const responseXml = await response.text();
      if (responseXml.includes("<fault>")) return "INCOMPLETE";
      if (responseXml.includes(mediaUrl) || new RegExp(`(?:>|&quot;|:)${mediaId}(?:<|&quot;|,|})`).test(responseXml)) return "REFERENCED";
      const recordCount = (responseXml.match(/<name>post_id<\/name>/g) ?? []).length;
      if (recordCount < 100) return "CLEAR";
    }
    return "INCOMPLETE";
  }

  async function readPage(pageId: number): Promise<PublishedContextualPage | null> {
    for (const collection of ["pages", "posts"] as const) {
      const response = await fetch(`${apiBase}/${collection}/${pageId}?context=edit&_fields=id,slug,status,parent,featured_media,title,content,yoast_head_json&_contextual=${crypto.randomUUID()}`, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.status === 404) continue;
      if (!response.ok) return null;
      const page = await response.json() as WordPressPage;
      if (!page.id || !page.slug || !page.status || !page.title?.raw || typeof page.content?.raw !== "string") return null;
      targetCollections.set(pageId, collection);
      return { id: page.id, slug: page.slug, status: page.status, parent: Number(page.parent ?? 0), featuredMediaId: Number(page.featured_media ?? 0), content: page.content.raw, canonicalUrl: String(page.yoast_head_json?.canonical ?? ""), robots: page.yoast_head_json?.robots ?? {}, title: page.title.raw };
    }
    return null;
  }

  async function readMedia(mediaId: number): Promise<ContextualMediaRecord | null> {
    const response = await fetch(`${apiBase}/media/${mediaId}?context=edit&_fields=id,media_type,source_url,alt_text&_contextual=${crypto.randomUUID()}`, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const media = await response.json() as WordPressMedia;
    const url = String(media.source_url ?? media.guid?.rendered ?? "");
    if (!media.id || !url) return null;
    return { id: media.id, url, altText: String(media.alt_text ?? ""), mediaType: String(media.media_type ?? "") };
  }

  return {
    readPage,
    async verifyTargetAuthority(page) {
      const candidates: WordPressPage[] = [];
      for (const collection of ["pages", "posts"] as const) {
        const candidatesResponse = await fetch(`${apiBase}/${collection}?slug=${encodeURIComponent(page.slug)}&context=edit&status=any&per_page=100&_fields=id,slug,status&_contextual=${crypto.randomUUID()}`, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!candidatesResponse.ok) return false;
        candidates.push(...await candidatesResponse.json() as WordPressPage[]);
      }
      if (candidates.length !== 1 || candidates[0].id !== page.id || candidates[0].status !== "publish") return false;
      const redirectUrl = new URL(`${origin}/wp-json/ssi/v1/redirect`);
      redirectUrl.searchParams.set("source", new URL(page.canonicalUrl).pathname);
      const redirectResponse = await fetch(redirectUrl, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!redirectResponse.ok) return false;
      const redirect = await redirectResponse.json() as { exists?: boolean };
      return redirect.exists === false;
    },
    readMedia,
    async uploadGeneratedMedia(input) {
      const filename = `contextual-application-${Date.now()}.${extension(input.fileExtension)}`;
      const response = await fetch(`${apiBase}/media`, { method: "POST", headers: { Accept: "application/json", Authorization: auth, "Content-Disposition": `attachment; filename="${filename}"`, "Content-Type": input.mimeType }, body: Uint8Array.from(input.bytes).buffer, cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("GENERATED_MEDIA_UPLOAD_FAILED");
      const media = await response.json() as WordPressMedia;
      const id = Number(media.id ?? 0); const url = String(media.source_url ?? media.guid?.rendered ?? "");
      if (!Number.isSafeInteger(id) || id <= 0 || !url) throw new Error("GENERATED_MEDIA_IDENTITY_MISSING");
      uploadedUrls.set(id, url);
      return { id, url, altText: "", mediaType: "image" };
    },
    async updateMediaMetadata(mediaId, input) {
      const response = await fetch(`${apiBase}/media/${mediaId}`, { method: "POST", headers: { ...readHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: input.altText, title: input.altText, description: input.description }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return response.ok;
    },
    async writePublishedPageContent(pageId, input) {
      const collection = targetCollections.get(pageId);
      if (!collection) return false;
      const response = await fetch(`${apiBase}/${collection}/${pageId}`, { method: "POST", headers: { ...readHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ content: input.content, featured_media: input.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(20_000) });
      return response.ok;
    },
    async fetchPublicHtml(canonicalUrl) {
      const url = new URL(canonicalUrl);
      if (url.origin !== origin) return { status: 0, html: "" };
      url.searchParams.set("_contextual", crypto.randomUUID());
      const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20_000) });
      return { status: response.status, html: await response.text() };
    },
    async findMediaReferences(mediaId) {
      const mediaUrl = uploadedUrls.get(mediaId) ?? (await readMedia(mediaId))?.url ?? "";
      if (!mediaUrl) return [-1];
      const references = new Set<number>();
      const typesResponse = await fetch(`${apiBase}/types?context=edit&_contextual=${crypto.randomUUID()}`, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!typesResponse.ok) return [-1];
      const types = await typesResponse.json() as Record<string, { rest_base?: string }>;
      const restBases = [...new Set(Object.values(types)
        .map((type) => type.rest_base ?? "")
        .filter((restBase) => restBase !== "media" && /^[a-z0-9_-]+$/i.test(restBase)))];
      if (restBases.length === 0) return [-1];
      const escapedUrl = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exactAttribute = new RegExp(`(?:src|href)=["']${escapedUrl}["']`, "i");
      for (const type of restBases) {
        for (let page = 1; page <= 100; page += 1) {
          const response = await fetch(`${apiBase}/${type}?context=edit&status=any&per_page=100&page=${page}&_fields=id,featured_media,content&_contextual=${crypto.randomUUID()}`, { headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(20_000) });
          if (response.status === 400) break;
          if (response.status === 401 || response.status === 403) {
            const postType = Object.entries(types).find(([, value]) => value.rest_base === type)?.[0];
            if (!postType) return [-1];
            const fallback = await scanRestrictedType(postType, mediaId, mediaUrl);
            if (fallback === "INCOMPLETE") return [-1];
            if (fallback === "REFERENCED") references.add(-2);
            break;
          }
          if (!response.ok) return [-1];
          const records = await response.json() as WordPressPage[];
          for (const record of records) {
            if (Number(record.featured_media ?? 0) === mediaId || exactAttribute.test(String(record.content?.raw ?? ""))) references.add(Number(record.id));
          }
          if (records.length < 100) break;
          if (page === 100) return [-1];
        }
      }
      return [...references];
    },
    async deleteGeneratedMedia(mediaId) {
      if (!uploadedUrls.has(mediaId)) return false;
      const response = await fetch(`${apiBase}/media/${mediaId}?force=true`, { method: "DELETE", headers: readHeaders, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.ok) uploadedUrls.delete(mediaId);
      return response.ok;
    },
  };
}
