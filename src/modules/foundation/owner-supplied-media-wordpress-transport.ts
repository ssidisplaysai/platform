import "server-only";

import { basename } from "node:path";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import type { OwnerMediaRecord, OwnerMediaTransport } from "./owner-supplied-media-ingestion";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressMedia = { id?: number; status?: string; mime_type?: string; source_url?: string; guid?: { rendered?: string }; title?: { raw?: string; rendered?: string }; alt_text?: string; media_details?: { width?: number; height?: number } };
type WordPressContent = { id?: number; featured_media?: number; content?: { raw?: string } };

function basic(username: string, password: string): string { return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`; }
function mediaRecord(media: WordPressMedia): OwnerMediaRecord | null {
  const id = Number(media.id ?? 0), url = String(media.source_url ?? media.guid?.rendered ?? "");
  if (!Number.isSafeInteger(id) || id <= 0 || !url) return null;
  return { id, url, mimeType: String(media.mime_type ?? ""), title: String(media.title?.raw ?? media.title?.rendered ?? ""), altText: String(media.alt_text ?? ""), status: String(media.status ?? ""), width: Number(media.media_details?.width ?? 0), height: Number(media.media_details?.height ?? 0) };
}

export function createOwnerSuppliedMediaWordPressTransport(site: SiteConfiguration): OwnerMediaTransport | null {
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl || site.siteId !== "site-ssi-projectorenclosure" || site.domain.replace(/^www\./, "") !== "projectorenclosure.com") return null;
  const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl), origin = new URL(apiBase).origin, hostname = new URL(origin).hostname.replace(/^www\./, ""), authorization = basic(credential.username, credential.applicationPassword), created = new Set<number>(), headers = { Accept: "application/json", Authorization: authorization, "Cache-Control": "no-cache, no-store", Pragma: "no-cache" };

  async function read(mediaId: number): Promise<OwnerMediaRecord | null> {
    const response = await fetch(`${apiBase}/media/${mediaId}?context=edit&_fields=id,status,mime_type,source_url,guid,title,alt_text,media_details&_owner_media=${crypto.randomUUID()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return response.ok ? mediaRecord(await response.json() as WordPressMedia) : null;
  }

  async function findReferences(mediaId: number): Promise<readonly number[]> {
    const record = await read(mediaId); if (!record) return [-1];
    const escaped = record.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), pattern = new RegExp(`(?:src|href)=["']${escaped}["']`, "i"), found = new Set<number>();
    for (const collection of ["pages", "posts", "portfolio", "product"]) {
      for (let page = 1; page <= 100; page += 1) {
        const response = await fetch(`${apiBase}/${collection}?context=edit&status=any&per_page=100&page=${page}&_fields=id,featured_media,content&_owner_media=${crypto.randomUUID()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
        if (response.status === 400 || response.status === 404) break;
        if (!response.ok) return [-1];
        const records = await response.json() as WordPressContent[];
        for (const item of records) if (Number(item.featured_media ?? 0) === mediaId || pattern.test(String(item.content?.raw ?? ""))) found.add(Number(item.id));
        if (records.length < 100) break;
      }
    }
    return [...found];
  }

  return {
    hostname,
    async findExact(authority) {
      let ambiguous = false;
      for (let page = 1; page <= 100; page += 1) {
        const response = await fetch(`${apiBase}/media?context=edit&search=${encodeURIComponent(authority.title)}&per_page=100&page=${page}&_fields=id,status,mime_type,source_url,guid,title,alt_text,media_details&_owner_media=${crypto.randomUUID()}`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
        if (response.status === 400) break;
        if (!response.ok) throw new Error("OWNER_MEDIA_DUPLICATE_SEARCH_FAILED");
        const items = await response.json() as WordPressMedia[];
        for (const item of items) {
          const record = mediaRecord(item); if (!record) continue;
          if (decodeURIComponent(basename(new URL(record.url).pathname)) !== authority.filename) continue;
          if (record.title === authority.title && record.altText === authority.altText && record.mimeType === authority.mimeType) return record;
          ambiguous = true;
        }
        if (items.length < 100) break;
      }
      if (ambiguous) throw new Error("OWNER_MEDIA_EXISTING_IDENTITY_AMBIGUOUS");
      return null;
    },
    async upload(authority, bytes) {
      const response = await fetch(`${apiBase}/media`, { method: "POST", headers: { ...headers, "Content-Disposition": `attachment; filename="${authority.filename}"`, "Content-Type": authority.mimeType }, body: Uint8Array.from(bytes).buffer, cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`OWNER_MEDIA_UPLOAD_FAILED:${response.status}`);
      const record = mediaRecord(await response.json() as WordPressMedia); if (!record) throw new Error("OWNER_MEDIA_UPLOAD_IDENTITY_MISSING");
      created.add(record.id); return record;
    },
    async updateMetadata(mediaId, authority) {
      if (!created.has(mediaId)) return false;
      const response = await fetch(`${apiBase}/media/${mediaId}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: authority.title, alt_text: authority.altText, description: `${authority.allowedPurpose}. Source: ${authority.sourceAuthorityReference}. SHA-256: ${authority.sha256}.` }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return response.ok;
    },
    read,
    async readBytes(url) {
      const parsed = new URL(url); if (parsed.origin !== origin) return null;
      const response = await fetch(parsed, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    },
    findReferences,
    async deleteCreated(mediaId) {
      if (!created.has(mediaId) || (await findReferences(mediaId)).length !== 0) return false;
      const response = await fetch(`${apiBase}/media/${mediaId}?force=true`, { method: "DELETE", headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.ok) created.delete(mediaId);
      return response.ok;
    },
  };
}
