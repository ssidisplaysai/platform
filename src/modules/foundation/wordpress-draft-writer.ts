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

export type GenesisWordPressSeoMetadata = {
  focusKeyphrase: string;
  seoTitle: string;
  metaDescription: string;
};

export type GenesisWordPressDraftArtifact = {
  title: string;
  contentHtml: string;
  slug: string;
  excerpt?: string | null;
  parentId?: number | null;
  seo?: GenesisWordPressSeoMetadata | null;
};

export type GenesisWordPressDraftWriteInput =
  | {
      operation: "CREATE";
      site: SiteConfiguration;
      artifact: GenesisWordPressDraftArtifact;
      wordpressObjectId?: never;
    }
  | {
      operation: "UPDATE";
      site: SiteConfiguration;
      artifact: GenesisWordPressDraftArtifact;
      wordpressObjectId: string;
    };

export type GenesisWordPressDraftWriteResult =
  | {
      ok: true;
      operation: "CREATE" | "UPDATE";
      wordpressObjectId: string;
      wordpressUrl: string;
      wordpressStatus: "draft";
      seoMetadataAttempted: boolean;
      seoMetadataAccepted: boolean;
    }
  | {
      ok: false;
      state:
        | "not_configured"
        | "credential_unavailable"
        | "invalid_target"
        | "read_failed"
        | "collision"
        | "published_target"
        | "identity_mismatch"
        | "write_failed";
      message: string;
    };

function normalizeSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.trim()
    .toLowerCase() ?? "";
}

function normalizeObjectId(value: string): number | null {
  const normalized = value.trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

function normalizeParentId(value: number | null | undefined): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0
    ? value
    : null;
}

function createAuthorizationHeader(
  username: string,
  applicationPassword: string,
): string {
  return `Basic ${Buffer.from(
    `${username}:${applicationPassword}`,
    "utf8",
  ).toString("base64")}`;
}

function isWordPressPage(value: unknown): value is WordPressPage {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value),
  );
}

function exactPageFromBody(
  body: unknown,
  expectedSlug: string,
  expectedParentId: number | null,
): WordPressPage | null {
  if (!Array.isArray(body)) {
    return null;
  }

  const exact = body.filter(
    (candidate): candidate is WordPressPage =>
      isWordPressPage(candidate)
      && normalizeSlug(
        typeof candidate.slug === "string"
          ? candidate.slug
          : "",
      ) === expectedSlug
      && (
        expectedParentId === null
          ? true
          : candidate.parent === expectedParentId
      ),
  );

  return exact.length === 1
    ? exact[0]
    : null;
}

async function readJson(
  url: string,
  authorization: string,
): Promise<
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
    }
> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        ok: false,
      };
    }

    return {
      ok: true,
      body: await response.json(),
    };
  } catch {
    return {
      ok: false,
    };
  }
}

function buildYoastMeta(
  seo: GenesisWordPressSeoMetadata | null | undefined,
): Record<string, string> | null {
  if (!seo) return null;

  const focusKeyphrase = seo.focusKeyphrase.trim();
  const seoTitle = seo.seoTitle.trim();
  const metaDescription = seo.metaDescription.trim();

  if (!focusKeyphrase || !seoTitle || !metaDescription) {
    return null;
  }

  return {
    _yoast_wpseo_focuskw: focusKeyphrase,
    _yoast_wpseo_title: seoTitle,
    _yoast_wpseo_metadesc: metaDescription,
  };
}

export async function writeGenesisWordPressDraft(
  input: GenesisWordPressDraftWriteInput,
): Promise<GenesisWordPressDraftWriteResult> {
  const configuredApiBaseUrl =
    input.site.integrations.wordpressApiBaseUrl;

  const credentialReference =
    input.site.integrations.wordpressCredentialReference;

  if (!configuredApiBaseUrl || !credentialReference) {
    return {
      ok: false,
      state: "not_configured",
      message:
        "WordPress API or credential reference is not configured.",
    };
  }

  let apiBaseUrl: string;

  try {
    apiBaseUrl = normalizeWordPressApiBaseUrl(
      configuredApiBaseUrl,
    );
  } catch {
    return {
      ok: false,
      state: "invalid_target",
      message:
        "The configured WordPress API target is invalid or does not satisfy Genesis transport requirements.",
    };
  }

  const credential =
    resolveWordPressCredentialReference(
      credentialReference,
    );

  if (!credential) {
    return {
      ok: false,
      state: "credential_unavailable",
      message:
        "The configured WordPress credential reference could not be resolved.",
    };
  }

  const slug = normalizeSlug(input.artifact.slug);
  const title = input.artifact.title.trim();
  const contentHtml = input.artifact.contentHtml.trim();
  const parentId = normalizeParentId(input.artifact.parentId);

  if (!slug || !title || !contentHtml) {
    return {
      ok: false,
      state: "invalid_target",
      message:
        "Genesis requires a non-empty title, content artifact, and canonical target slug.",
    };
  }

  if (input.artifact.parentId != null && parentId === null) {
    return {
      ok: false,
      state: "invalid_target",
      message:
        "Genesis requires an exact positive WordPress parent ID when hierarchy authority is supplied.",
    };
  }

  const authorization = createAuthorizationHeader(
    credential.username,
    credential.applicationPassword,
  );

  const lookupQuery = new URLSearchParams({
    slug,
    context: "edit",
    status: "publish,draft,pending,private,future",
    per_page: "100",
    _fields: "id,slug,parent,status,link",
  });

  if (parentId !== null) {
    lookupQuery.set("parent", String(parentId));
  }

  const lookup = await readJson(
    `${apiBaseUrl}/pages?${lookupQuery.toString()}`,
    authorization,
  );

  if (!lookup.ok) {
    return {
      ok: false,
      state: "read_failed",
      message:
        "Genesis could not authoritatively verify the exact WordPress target before mutation.",
    };
  }

  const exactExisting = exactPageFromBody(
    lookup.body,
    slug,
    parentId,
  );

  let writeUrl: string;

  if (input.operation === "CREATE") {
    if (exactExisting?.id) {
      return {
        ok: false,
        state: exactExisting.status === "publish"
          ? "published_target"
          : "collision",
        message: exactExisting.status === "publish"
          ? "The canonical WordPress target is already published. Genesis will not overwrite it."
          : "The canonical WordPress target already exists beneath the authorized parent. Genesis will not create a duplicate or adopt it automatically.",
      };
    }

    writeUrl = `${apiBaseUrl}/pages`;
  } else {
    const wordpressObjectId = normalizeObjectId(
      input.wordpressObjectId,
    );

    if (!wordpressObjectId) {
      return {
        ok: false,
        state: "invalid_target",
        message:
          "Genesis requires an exact numeric WordPress object ID for draft updates.",
      };
    }

    const objectLookup = await readJson(
      `${apiBaseUrl}/pages/${wordpressObjectId}?context=edit&_fields=id,slug,parent,status,link`,
      authorization,
    );

    if (!objectLookup.ok) {
      return {
        ok: false,
        state: "read_failed",
        message:
          "Genesis could not authoritatively verify the WordPress object selected for update.",
      };
    }

    if (!isWordPressPage(objectLookup.body)) {
      return {
        ok: false,
        state: "identity_mismatch",
        message:
          "WordPress did not return a valid object for the requested draft update.",
      };
    }

    const current = objectLookup.body;

    if (current.id !== wordpressObjectId) {
      return {
        ok: false,
        state: "identity_mismatch",
        message:
          "The returned WordPress object does not match the exact persisted object ID.",
      };
    }

    if (current.status === "publish") {
      return {
        ok: false,
        state: "published_target",
        message:
          "Genesis will not overwrite or demote a published WordPress page.",
      };
    }

    if (current.status !== "draft") {
      return {
        ok: false,
        state: "identity_mismatch",
        message:
          "Genesis only permits automatic updates to an exact existing WordPress draft.",
      };
    }

    if (
      normalizeSlug(
        typeof current.slug === "string"
          ? current.slug
          : "",
      ) !== slug
    ) {
      return {
        ok: false,
        state: "identity_mismatch",
        message:
          "The exact WordPress object ID does not match the canonical target slug.",
      };
    }

    if (parentId !== null && current.parent !== parentId) {
      return {
        ok: false,
        state: "identity_mismatch",
        message:
          "The exact WordPress object ID is not beneath the authorized canonical parent. Genesis will not silently re-parent it.",
      };
    }

    if (
      exactExisting?.id
      && exactExisting.id !== wordpressObjectId
    ) {
      return {
        ok: false,
        state: "collision",
        message:
          "Another WordPress object already occupies the canonical target beneath the authorized parent.",
      };
    }

    writeUrl = `${apiBaseUrl}/pages/${wordpressObjectId}`;
  }

  const body: Record<string, unknown> = {
    title,
    slug,
    content: contentHtml,
    status: "draft",
  };

  const excerpt = input.artifact.excerpt?.trim();

  if (excerpt) {
    body.excerpt = excerpt;
  }

  if (parentId !== null) {
    body.parent = parentId;
  }

  const yoastMeta = buildYoastMeta(input.artifact.seo);
  const seoMetadataAttempted = Boolean(yoastMeta);

  if (yoastMeta) {
    body.meta = yoastMeta;
  }

  let writeResponse: Response;

  try {
    writeResponse = await fetch(writeUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      ok: false,
      state: "write_failed",
      message:
        "Genesis could not complete the WordPress draft mutation request.",
    };
  }

  if (!writeResponse.ok) {
    return {
      ok: false,
      state: "write_failed",
      message:
        `WordPress draft mutation failed with HTTP ${writeResponse.status}.`,
    };
  }

  let written: WordPressPage;

  try {
    written = (await writeResponse.json()) as WordPressPage;
  } catch {
    return {
      ok: false,
      state: "write_failed",
      message:
        "WordPress returned a malformed draft mutation response.",
    };
  }

  if (
    !written.id
    || written.status !== "draft"
    || !written.link
    || normalizeSlug(
      typeof written.slug === "string"
        ? written.slug
        : "",
      ) !== slug
    || (parentId !== null && written.parent !== parentId)
  ) {
    return {
      ok: false,
      state: "write_failed",
      message:
        "WordPress did not return a confirmed exact draft identity beneath the authorized parent.",
    };
  }

  if (
    input.operation === "UPDATE"
    && written.id !== normalizeObjectId(
      input.wordpressObjectId,
    )
  ) {
    return {
      ok: false,
      state: "identity_mismatch",
      message:
        "WordPress returned a different object ID after the requested exact draft update.",
    };
  }

  return {
    ok: true,
    operation: input.operation,
    wordpressObjectId: String(written.id),
    wordpressUrl: written.link,
    wordpressStatus: "draft",
    seoMetadataAttempted,
    seoMetadataAccepted: seoMetadataAttempted,
  };
}
