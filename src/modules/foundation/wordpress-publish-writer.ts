import "server-only";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { SiteConfiguration } from "./types";

type WordPressPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
};

export type GenesisWordPressPublishResult =
  | {
      ok: true;
      wordpressObjectId: string;
      wordpressUrl: string | null;
      wordpressStatus: "publish";
      publicationPerformed: boolean;
      alreadyPublished: boolean;
    }
  | {
      ok: false;
      state:
        | "not_configured"
        | "credential_unavailable"
        | "invalid_target"
        | "read_failed"
        | "identity_mismatch"
        | "write_failed"
        | "verification_failed";
      message: string;
    };

function normalizeObjectId(value: string): number | null {
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function createAuthorizationHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`;
}

function isWordPressPage(value: unknown): value is WordPressPage {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function describePage(page: WordPressPage): string {
  const id = typeof page.id === "number" ? String(page.id) : "missing";
  const status = typeof page.status === "string" && page.status.trim() ? page.status : "missing";
  const slug = typeof page.slug === "string" && page.slug.trim() ? page.slug : "missing";
  const parent = typeof page.parent === "number" ? String(page.parent) : "missing";
  return `id=${id}, status=${status}, slug=${slug}, parent=${parent}`;
}

async function readPage(input: {
  apiBaseUrl: string;
  authorization: string;
  wordpressObjectId: number;
}): Promise<{ ok: true; page: WordPressPage } | { ok: false; status?: number }> {
  try {
    const query = new URLSearchParams({
      context: "edit",
      _fields: "id,slug,parent,status,link",
      _genesis_read_nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    const response = await fetch(
      `${input.apiBaseUrl}/pages/${input.wordpressObjectId}?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: input.authorization,
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) return { ok: false, status: response.status };
    const body = await response.json();
    return isWordPressPage(body) ? { ok: true, page: body } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function publishGenesisWordPressDraft(input: {
  site: SiteConfiguration;
  wordpressObjectId: string;
}): Promise<GenesisWordPressPublishResult> {
  const configuredApiBaseUrl = input.site.integrations.wordpressApiBaseUrl;
  const credentialReference = input.site.integrations.wordpressCredentialReference;

  if (!configuredApiBaseUrl || !credentialReference) {
    return { ok: false, state: "not_configured", message: "WordPress API or credential reference is not configured." };
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = normalizeWordPressApiBaseUrl(configuredApiBaseUrl);
  } catch {
    return { ok: false, state: "invalid_target", message: "The configured WordPress API target is invalid or does not satisfy Genesis transport requirements." };
  }

  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!credential) {
    return { ok: false, state: "credential_unavailable", message: "The configured WordPress credential reference could not be resolved." };
  }

  const wordpressObjectId = normalizeObjectId(input.wordpressObjectId);
  if (!wordpressObjectId) {
    return { ok: false, state: "invalid_target", message: "Genesis requires an exact numeric WordPress object ID for publication." };
  }

  const authorization = createAuthorizationHeader(credential.username, credential.applicationPassword);
  const before = await readPage({ apiBaseUrl, authorization, wordpressObjectId });
  if (!before.ok) {
    return { ok: false, state: "read_failed", message: `Genesis could not authoritatively read the exact WordPress object before publication${before.status ? ` (HTTP ${before.status})` : ""}.` };
  }

  if (before.page.id !== wordpressObjectId) {
    return { ok: false, state: "identity_mismatch", message: `WordPress returned a different object identity before publication (${describePage(before.page)}).` };
  }

  if (before.page.status === "publish") {
    return {
      ok: true,
      wordpressObjectId: String(wordpressObjectId),
      wordpressUrl: typeof before.page.link === "string" && before.page.link.trim() ? before.page.link : null,
      wordpressStatus: "publish",
      publicationPerformed: false,
      alreadyPublished: true,
    };
  }

  if (before.page.status !== "draft") {
    return { ok: false, state: "identity_mismatch", message: `Genesis only publishes exact WordPress drafts; before-read returned ${describePage(before.page)}.` };
  }

  let writeResponse: Response;
  try {
    writeResponse = await fetch(`${apiBaseUrl}/pages/${wordpressObjectId}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "publish" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, state: "write_failed", message: "Genesis could not complete the WordPress publication request." };
  }

  if (!writeResponse.ok) {
    return { ok: false, state: "write_failed", message: `WordPress publication failed with HTTP ${writeResponse.status}.` };
  }

  const after = await readPage({ apiBaseUrl, authorization, wordpressObjectId });
  if (!after.ok) {
    return { ok: false, state: "verification_failed", message: `Genesis could not verify the WordPress object after publication${after.status ? ` (HTTP ${after.status})` : ""}.` };
  }

  if (
    after.page.id !== wordpressObjectId
    || after.page.status !== "publish"
    || after.page.slug !== before.page.slug
    || after.page.parent !== before.page.parent
  ) {
    return {
      ok: false,
      state: "verification_failed",
      message: `WordPress post-write verification mismatch. Expected id=${wordpressObjectId}, status=publish, slug=${before.page.slug ?? "missing"}, parent=${before.page.parent ?? "missing"}; received ${describePage(after.page)}.`,
    };
  }

  return {
    ok: true,
    wordpressObjectId: String(wordpressObjectId),
    wordpressUrl: typeof after.page.link === "string" && after.page.link.trim() ? after.page.link : null,
    wordpressStatus: "publish",
    publicationPerformed: true,
    alreadyPublished: false,
  };
}
