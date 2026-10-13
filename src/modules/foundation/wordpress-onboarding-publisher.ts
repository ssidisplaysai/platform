import "server-only";

import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

export const GENESIS_TEST_PAGE = {
  title: "Genesis Site Connection Test",
  slug: "genesis-site-connection-test",
  content: [
    "<p>This page was created for your site by Genesis.</p>",
    "<p>Genesis successfully connected to this WordPress site and completed its first page publication.</p>",
  ].join(""),
} as const;

type WordPressPage = {
  id: number;
  slug?: string;
  status?: string;
  link?: string;
};

export type GenesisTestPagePublishResult =
  | {
      ok: true;
      state: "already_published" | "published";
      wordpressObjectId: string;
      url: string;
    }
  | {
      ok: false;
      state: "not_configured" | "credential_unavailable" | "read_failed" | "publish_failed";
      message: string;
    };

function authorizationHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString("base64")}`;
}

export async function publishGenesisTestPage(
  site: SiteConfiguration,
): Promise<GenesisTestPagePublishResult> {
  const apiBaseUrl = site.integrations.wordpressApiBaseUrl?.replace(/\/+$/, "");
  const credentialReference = site.integrations.wordpressCredentialReference;

  if (!apiBaseUrl || !credentialReference) {
    return {
      ok: false,
      state: "not_configured",
      message: "WordPress API or credential reference is not configured.",
    };
  }

  const credential = resolveWordPressCredentialReference(credentialReference);

  if (!credential) {
    return {
      ok: false,
      state: "credential_unavailable",
      message: "The configured WordPress credential reference could not be resolved.",
    };
  }

  const authorization = authorizationHeader(
    credential.username,
    credential.applicationPassword,
  );

  const query = new URLSearchParams({
    slug: GENESIS_TEST_PAGE.slug,
    context: "edit",
    per_page: "1",
    _fields: "id,slug,status,link",
  });

  let existingResponse: Response;

  try {
    existingResponse = await fetch(`${apiBaseUrl}/pages?${query.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return {
      ok: false,
      state: "read_failed",
      message: "Genesis could not verify whether the onboarding test page already exists.",
    };
  }

  if (!existingResponse.ok) {
    return {
      ok: false,
      state: "read_failed",
      message: `WordPress page lookup failed with HTTP ${existingResponse.status}.`,
    };
  }

  const existingBody = (await existingResponse.json()) as WordPressPage[];
  const existing = Array.isArray(existingBody) ? existingBody[0] : undefined;

  if (existing?.id) {
    if (existing.status === "publish" && existing.link) {
      return {
        ok: true,
        state: "already_published",
        wordpressObjectId: String(existing.id),
        url: existing.link,
      };
    }

    return {
      ok: false,
      state: "publish_failed",
      message:
        "The Genesis onboarding slug already exists but is not published. Genesis will not overwrite it automatically.",
    };
  }

  let publishResponse: Response;

  try {
    publishResponse = await fetch(`${apiBaseUrl}/pages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: GENESIS_TEST_PAGE.title,
        slug: GENESIS_TEST_PAGE.slug,
        content: GENESIS_TEST_PAGE.content,
        status: "publish",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return {
      ok: false,
      state: "publish_failed",
      message: "Genesis could not complete the WordPress publication request.",
    };
  }

  if (!publishResponse.ok) {
    return {
      ok: false,
      state: "publish_failed",
      message: `WordPress publication failed with HTTP ${publishResponse.status}.`,
    };
  }

  const published = (await publishResponse.json()) as WordPressPage;

  if (!published?.id || published.status !== "publish" || !published.link) {
    return {
      ok: false,
      state: "publish_failed",
      message: "WordPress did not return a confirmed published page.",
    };
  }

  return {
    ok: true,
    state: "published",
    wordpressObjectId: String(published.id),
    url: published.link,
  };
}