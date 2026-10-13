import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { createWordPressSeoWriter } from "@/modules/foundation/wordpress-seo-writer";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

type WordPressPage = {
  id?: number;
  status?: string;
  slug?: string;
  parent?: number;
  template?: string;
  link?: string;
  title?: { raw?: string };
  excerpt?: { raw?: string };
  content?: { raw?: string; rendered?: string };
  featured_media?: number;
  meta?: Record<string, unknown>;
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function inspectDallasWordPressAuthority(
  expectedStatus: "draft" | "publish" = "draft",
) {
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!site || !site.integrations.wordpressApiBaseUrl)
    throw new Error("DALLAS_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!credential) throw new Error("DALLAS_WORDPRESS_CREDENTIAL_REQUIRED");
  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: site.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });
  const response = await authority.getJson({
    path: "/pages/13084",
    query: new URLSearchParams({
      context: "edit",
      _fields:
        "id,status,slug,parent,template,link,title,excerpt,content,featured_media,meta",
    }),
  });
  if (
    !response.ok ||
    !response.body ||
    typeof response.body !== "object" ||
    Array.isArray(response.body)
  )
    throw new Error("DALLAS_WORDPRESS_AUTHORITY_READ_FAILED");
  const page = response.body as WordPressPage;
  if (
    page.id !== 13084 ||
    page.status !== expectedStatus ||
    page.slug !== "dallas"
  )
    throw new Error("DALLAS_WORDPRESS_AUTHORITY_IDENTITY_MISMATCH");
  const content = text(page.content?.raw);
  const rendered = text(page.content?.rendered);
  const meta = page.meta ?? {};
  const elementorData = text(meta._elementor_data);
  const elementorMode = text(meta._elementor_edit_mode);
  const hrefs = [...content.matchAll(/href=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  const seoWriter = createWordPressSeoWriter(site);
  const seo = seoWriter
    ? await seoWriter.read(13084)
    : { ok: false, stored: null };
  return {
    identity: {
      organizationId: "ssi",
      siteId: site.siteId,
      wordpressObjectId: "13084",
      status: page.status,
      slug: page.slug,
      parent: page.parent ?? 0,
      template: text(page.template) || "default",
      title: text(page.title?.raw),
      link: text(page.link),
    },
    authorityMap: {
      operativeBody:
        elementorMode === "builder" && elementorData
          ? ("ELEMENTOR_DOCUMENT" as const)
          : ("WORDPRESS_POST_CONTENT" as const),
      shadowAuthority: elementorData
        ? ("WORDPRESS_POST_CONTENT" as const)
        : ("NONE" as const),
      templateAuthority: "WORDPRESS_THEME" as const,
      seoAuthority: seo.ok
        ? ("YOAST_REST" as const)
        : ("WORDPRESS_META_NOT_EXPOSED" as const),
      mediaAuthority: "WORDPRESS_MEDIA_LIBRARY" as const,
      elementor: {
        editMode: elementorMode || null,
        dataPresent: Boolean(elementorData),
        dataHash: elementorData ? hash(elementorData) : null,
      },
      registeredPageMeta: meta,
    },
    body: {
      raw: content,
      rendered,
      contentHash: hash(content),
      renderedHash: hash(rendered),
      excerpt: text(page.excerpt?.raw),
      h1Count: (content.match(/<h1\b/gi) ?? []).length,
      links: hrefs,
      mediaReferences: [...content.matchAll(/<img\b[^>]*src=["']([^"']+)/gi)]
        .map((match) => match[1])
        .concat(
          [...content.matchAll(/url\(["']?([^"')]+)/gi)].map(
            (match) => match[1],
          ),
        ),
      semanticRoles: [
        ...content.matchAll(/data-media-role=["']([^"']+)/gi),
      ].map((match) => match[1]),
    },
    featuredMediaId: Number(page.featured_media ?? 0),
    seo: {
      verified: seo.ok,
      stored: seo.stored,
      hash: hash(JSON.stringify(seo.stored)),
    },
    inspectedAt: new Date().toISOString(),
  };
}

export async function inspectDallasWordPressMedia(mediaIds: readonly number[]) {
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!site?.integrations.wordpressApiBaseUrl)
    throw new Error("DALLAS_SITE_AUTHORITY_REQUIRED");
  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!credential) throw new Error("DALLAS_WORDPRESS_CREDENTIAL_REQUIRED");
  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: site.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });
  return Promise.all(
    mediaIds.map(async (mediaId) => {
      const response = await authority.getJson({
        path: `/media/${mediaId}`,
        query: new URLSearchParams({
          context: "edit",
          _fields:
            "id,status,source_url,mime_type,alt_text,title,caption,description,media_details",
        }),
      });
      if (
        !response.ok ||
        !response.body ||
        typeof response.body !== "object" ||
        Array.isArray(response.body)
      )
        throw new Error(`DALLAS_MEDIA_READBACK_FAILED:${mediaId}`);
      const media = response.body as {
        id?: number;
        status?: string;
        source_url?: string;
        mime_type?: string;
        alt_text?: string;
        title?: { rendered?: string };
        caption?: { rendered?: string };
        description?: { rendered?: string };
        media_details?: { width?: number; height?: number };
      };
      return {
        id: media.id,
        status: media.status,
        url: media.source_url,
        mimeType: media.mime_type,
        width: media.media_details?.width,
        height: media.media_details?.height,
        altText: media.alt_text,
        title: text(media.title?.rendered),
        caption: text(media.caption?.rendered),
        description: text(media.description?.rendered),
      };
    }),
  );
}
