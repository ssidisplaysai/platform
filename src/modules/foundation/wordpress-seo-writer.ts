import "server-only";

import { getIntegrationProfileById } from "./integration-profile-repository";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { GenesisWordPressSeoMetadata } from "./wordpress-draft-writer";
import type { SiteConfiguration } from "./types";

type StoredSeo = {
  post_id?: number;
  focuskw?: string;
  title?: string;
  metadesc?: string;
};

type SeoResponse = {
  success?: boolean;
  verified?: boolean;
  stored?: StoredSeo;
};

function resolveEndpoint(site: SiteConfiguration): URL | null {
  const profileId = site.profiles.seoProfileReference;
  const profile = profileId ? getIntegrationProfileById(profileId) : null;
  const policy = profile?.references.yoastPolicyReference ?? "";
  const prefix = "wordpress-rest:";
  if (!policy.startsWith(prefix) || !site.canonicalUrl) return null;
  const path = policy.slice(prefix.length).trim();
  if (!/^\/[A-Za-z0-9_/-]+$/.test(path)) return null;
  return new URL(`/wp-json${path}`, site.canonicalUrl);
}

function exact(stored: StoredSeo | undefined, postId: number, seo: GenesisWordPressSeoMetadata): boolean {
  return stored?.post_id === postId
    && stored.focuskw === seo.focusKeyphrase
    && stored.title === seo.seoTitle
    && stored.metadesc === seo.metaDescription;
}

export function createWordPressSeoWriter(site: SiteConfiguration) {
  const endpoint = resolveEndpoint(site);
  const credential = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!endpoint || !credential) return null;

  const authorization = `Basic ${Buffer.from(
    `${credential.username}:${credential.applicationPassword}`,
    "utf8",
  ).toString("base64")}`;
  const headers = {
    Accept: "application/json",
    Authorization: authorization,
    "Cache-Control": "no-cache, no-store, max-age=0",
    Pragma: "no-cache",
  };

  return {
    async inspect(postId: number) {
      const index = await fetch(new URL("/wp-json/", endpoint), {
        method: "GET",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      const body = await index.json().catch(() => null) as { routes?: Record<string, { methods?: string[] }> } | null;
      const route = body?.routes?.[endpoint.pathname.replace(/^\/wp-json/, "")];
      const methods = route?.methods ?? [];
      const read = await this.read(postId);
      return {
        ready: index.ok && methods.includes("GET") && methods.includes("POST") && read.ok,
        methods,
      };
    },

    async read(postId: number): Promise<{ ok: boolean; stored: StoredSeo | null }> {
      const url = new URL(endpoint);
      url.searchParams.set("post_id", String(postId));
      url.searchParams.set("_genesis_read_nonce", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const response = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json().catch(() => null) as SeoResponse | null;
      return {
        ok: response.ok && body?.success === true && body.stored?.post_id === postId,
        stored: body?.stored ?? null,
      };
    },

    async write(postId: number, seo: GenesisWordPressSeoMetadata) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          focuskw: seo.focusKeyphrase,
          title: seo.seoTitle,
          metadesc: seo.metaDescription,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json().catch(() => null) as SeoResponse | null;
      return {
        ok: response.ok && body?.success === true && body.verified === true && exact(body.stored, postId, seo),
        stored: body?.stored ?? null,
      };
    },

    exact(stored: StoredSeo | null, postId: number, seo: GenesisWordPressSeoMetadata) {
      return exact(stored ?? undefined, postId, seo);
    },
  };
}