import "server-only";

import { createHash } from "node:crypto";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveSharedRichPageProductionProfile } from "./shared-rich-page-production-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

export type EligibleRichPageIdentity = {
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "LOCATION_SERVICE";
  wordpressObjectId: string;
  parentObjectId: string;
  slug: string;
  title: string;
  featuredMediaId: number;
  storedPostContentSha: string;
  expectedStatus?: "draft" | "publish";
};

type WordPressPage = {
  id?: number;
  status?: string;
  parent?: number;
  slug?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string };
  featured_media?: number;
  meta?: { _elementor_page_settings?: Record<string, unknown> };
};

type Fetcher = typeof fetch;

function sha256(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function assertIdentity(identity: EligibleRichPageIdentity, page: WordPressPage): void {
  if (String(page.id ?? "") !== identity.wordpressObjectId
    || page.status !== (identity.expectedStatus ?? "publish")
    || String(page.parent ?? "") !== identity.parentObjectId
    || page.slug !== identity.slug
    || (page.title?.raw ?? page.title?.rendered ?? "").replace(/<[^>]+>/g, "").trim() !== identity.title
    || Number(page.featured_media ?? 0) !== identity.featuredMediaId
    || typeof page.content?.raw !== "string"
    || sha256(page.content.raw) !== identity.storedPostContentSha) {
    throw new Error("ELIGIBLE_RICH_PAGE_HOST_TITLE_IDENTITY_MISMATCH");
  }
}

export async function repairEligibleRichPageNativeTitle(input: {
  site: SiteConfiguration;
  identity: EligibleRichPageIdentity;
  fetcher?: Fetcher;
}) {
  const profile = resolveSharedRichPageProductionProfile({
    organizationId: input.identity.organizationId,
    siteId: input.identity.siteId,
    productId: input.identity.productId,
    pageType: input.identity.pageType,
  });
  if (!profile || !profile.host.suppressNativeTitle) throw new Error("ELIGIBLE_RICH_PAGE_NATIVE_TITLE_SUPPRESSION_NOT_AUTHORIZED");
  if (input.site.organizationId !== input.identity.organizationId || input.site.siteId !== input.identity.siteId || !input.site.integrations.wordpressApiBaseUrl) throw new Error("ELIGIBLE_RICH_PAGE_SITE_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(input.site.integrations.wordpressCredentialReference);
  if (!credential) throw new Error("ELIGIBLE_RICH_PAGE_WORDPRESS_CREDENTIAL_REQUIRED");

  const apiBaseUrl = normalizeWordPressApiBaseUrl(input.site.integrations.wordpressApiBaseUrl);
  const headers = { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" };
  const fetcher = input.fetcher ?? fetch;
  const read = async () => {
    const query = new URLSearchParams({ context: "edit", _fields: "id,status,parent,slug,title,content,featured_media,meta" });
    query.set("_genesis_host_title_nonce", crypto.randomUUID());
    const response = await fetcher(`${apiBaseUrl}/pages/${input.identity.wordpressObjectId}?${query}`, { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`ELIGIBLE_RICH_PAGE_HOST_TITLE_READ_FAILED:${response.status}`);
    return await response.json() as WordPressPage;
  };

  const before = await read();
  assertIdentity(input.identity, before);
  const beforeSettings = before.meta?._elementor_page_settings ?? {};
  const alreadySuppressed = beforeSettings.hide_title === "yes";
  if (!alreadySuppressed) {
    const response = await fetcher(`${apiBaseUrl}/pages/${input.identity.wordpressObjectId}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { _elementor_page_settings: { ...beforeSettings, hide_title: "yes" } } }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`ELIGIBLE_RICH_PAGE_HOST_TITLE_WRITE_FAILED:${response.status}`);
  }
  const after = await read();
  assertIdentity(input.identity, after);
  if (after.meta?._elementor_page_settings?.hide_title !== "yes") throw new Error("ELIGIBLE_RICH_PAGE_HOST_TITLE_READBACK_FAILED");

  return {
    profileId: profile.profileId,
    integrationPolicy: profile.host.integrationPolicy,
    wordpressObjectId: input.identity.wordpressObjectId,
    statusBefore: before.status as "draft" | "publish",
    statusAfter: after.status as "draft" | "publish",
    parentObjectId: input.identity.parentObjectId,
    slug: input.identity.slug,
    title: input.identity.title,
    featuredMediaId: input.identity.featuredMediaId,
    postContentShaBefore: sha256(before.content!.raw!),
    postContentShaAfter: sha256(after.content!.raw!),
    nativeTitleSuppressedBefore: alreadySuppressed,
    nativeTitleSuppressedAfter: true as const,
    hostPresentationRepairPerformed: !alreadySuppressed,
    postContentMutationPerformed: false as const,
    publicationTransactionPerformed: false as const,
    rollbackPerformed: false as const,
  };
}
