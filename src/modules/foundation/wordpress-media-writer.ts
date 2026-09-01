import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressPage = {
  id?: number;
  status?: string;
  featured_media?: number;
  content?: { raw?: string; rendered?: string };
};

type WordPressMedia = {
  id?: number;
  source_url?: string;
  guid?: { rendered?: string };
};

export type GenesisWordPressMediaWriteResult =
  | {
      ok: true;
      mediaId: string;
      mediaUrl: string;
      featuredImagePresent: true;
    }
  | {
      ok: false;
      state:
        | "not_configured"
        | "credential_unavailable"
        | "invalid_target"
        | "read_failed"
        | "published_target"
        | "upload_failed"
        | "metadata_failed"
        | "attachment_failed"
        | "verification_failed";
      message: string;
    };

function createAuthorizationHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`;
}

function normalizeObjectId(value: string): number | null {
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeFilename(value: string, extension: string): string {
  const stem = value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "generated-page";
  return `${stem}.${extension}`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertHeroImage(contentHtml: string, mediaUrl: string, altText: string): string {
  const escapedUrl = escapeHtmlAttribute(mediaUrl);
  const escapedAlt = escapeHtmlAttribute(altText);
  const figure = `<figure class="page-hero-image"><img src="${escapedUrl}" alt="${escapedAlt}" loading="eager" fetchpriority="high" /></figure>`;
  if (contentHtml.includes(mediaUrl) || /class=["'][^"']*page-hero-image/i.test(contentHtml)) {
    return contentHtml;
  }
  if (/<\/h1>/i.test(contentHtml)) {
    return contentHtml.replace(/<\/h1>/i, (match) => `${match}\n${figure}`);
  }
  return `${figure}\n${contentHtml}`;
}

async function cleanupMedia(apiBaseUrl: string, authorization: string, mediaId: number): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/media/${mediaId}?force=true`, {
      method: "DELETE",
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Best-effort cleanup only. The primary failure is returned to the caller.
  }
}

export async function attachGenesisWordPressFeaturedImage(input: {
  site: SiteConfiguration;
  wordpressObjectId: string;
  canonicalSlug: string;
  contentHtml: string;
  image: {
    bytes: Buffer;
    mimeType: string;
    fileExtension: string;
  };
  title: string;
  altText: string;
  description: string;
}): Promise<GenesisWordPressMediaWriteResult> {
  const configuredApiBaseUrl = input.site.integrations.wordpressApiBaseUrl;
  const credentialReference = input.site.integrations.wordpressCredentialReference;

  if (!configuredApiBaseUrl || !credentialReference) {
    return { ok: false, state: "not_configured", message: "WordPress API or credential reference is not configured." };
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = normalizeWordPressApiBaseUrl(configuredApiBaseUrl);
  } catch {
    return { ok: false, state: "invalid_target", message: "The configured WordPress API target is invalid." };
  }

  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!credential) {
    return { ok: false, state: "credential_unavailable", message: "The configured WordPress credential reference could not be resolved." };
  }

  const pageId = normalizeObjectId(input.wordpressObjectId);
  if (!pageId || input.image.bytes.length === 0 || !input.contentHtml.trim()) {
    return { ok: false, state: "invalid_target", message: "Genesis requires an exact draft ID, non-empty content, and a non-empty image payload." };
  }

  const authorization = createAuthorizationHeader(credential.username, credential.applicationPassword);

  let pageResponse: Response;
  try {
    pageResponse = await fetch(`${apiBaseUrl}/pages/${pageId}?context=edit&_fields=id,status,featured_media,content`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, state: "read_failed", message: "Genesis could not verify the WordPress draft before media mutation." };
  }

  if (!pageResponse.ok) {
    return { ok: false, state: "read_failed", message: `WordPress draft verification failed with HTTP ${pageResponse.status}.` };
  }

  let page: WordPressPage;
  try {
    page = await pageResponse.json() as WordPressPage;
  } catch {
    return { ok: false, state: "read_failed", message: "WordPress returned a malformed draft verification response." };
  }

  if (page.id !== pageId) {
    return { ok: false, state: "invalid_target", message: "WordPress returned a different page identity before media mutation." };
  }
  if (page.status === "publish") {
    return { ok: false, state: "published_target", message: "Genesis will not attach generated media to an already-published page." };
  }
  if (page.status !== "draft") {
    return { ok: false, state: "invalid_target", message: "Genesis only attaches generated media to an exact WordPress draft." };
  }

  const filename = normalizeFilename(input.canonicalSlug, input.image.fileExtension);
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(`${apiBaseUrl}/media`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": input.image.mimeType,
      },
      body: input.image.bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, state: "upload_failed", message: "Genesis could not upload the generated image to WordPress." };
  }

  if (!uploadResponse.ok) {
    return { ok: false, state: "upload_failed", message: `WordPress media upload failed with HTTP ${uploadResponse.status}.` };
  }

  let media: WordPressMedia;
  try {
    media = await uploadResponse.json() as WordPressMedia;
  } catch {
    return { ok: false, state: "upload_failed", message: "WordPress returned a malformed media-upload response." };
  }

  const mediaId = Number(media.id || 0);
  const mediaUrl = String(media.source_url || media.guid?.rendered || "").trim();
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0 || !mediaUrl) {
    return { ok: false, state: "upload_failed", message: "WordPress did not return an exact uploaded media identity." };
  }

  let metadataResponse: Response;
  try {
    metadataResponse = await fetch(`${apiBaseUrl}/media/${mediaId}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title.trim(),
        alt_text: input.altText.trim(),
        description: input.description.trim(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    await cleanupMedia(apiBaseUrl, authorization, mediaId);
    return { ok: false, state: "metadata_failed", message: "Genesis could not apply WordPress media metadata." };
  }

  if (!metadataResponse.ok) {
    await cleanupMedia(apiBaseUrl, authorization, mediaId);
    return { ok: false, state: "metadata_failed", message: `WordPress media metadata update failed with HTTP ${metadataResponse.status}.` };
  }

  const content = insertHeroImage(input.contentHtml.trim(), mediaUrl, input.altText.trim());
  let attachResponse: Response;
  try {
    attachResponse = await fetch(`${apiBaseUrl}/pages/${pageId}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        featured_media: mediaId,
        status: "draft",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    await cleanupMedia(apiBaseUrl, authorization, mediaId);
    return { ok: false, state: "attachment_failed", message: "Genesis could not attach the generated image to the WordPress draft." };
  }

  if (!attachResponse.ok) {
    await cleanupMedia(apiBaseUrl, authorization, mediaId);
    return { ok: false, state: "attachment_failed", message: `WordPress featured-image assignment failed with HTTP ${attachResponse.status}.` };
  }

  let attached: WordPressPage;
  try {
    attached = await attachResponse.json() as WordPressPage;
  } catch {
    return { ok: false, state: "verification_failed", message: "WordPress returned a malformed featured-image assignment response." };
  }

  if (attached.id !== pageId || attached.status !== "draft" || Number(attached.featured_media || 0) !== mediaId) {
    return { ok: false, state: "verification_failed", message: "WordPress did not confirm the exact draft and featured-media identity." };
  }

  return {
    ok: true,
    mediaId: String(mediaId),
    mediaUrl,
    featuredImagePresent: true,
  };
}
