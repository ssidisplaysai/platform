import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

type WordPressPage = {
  id?: number;
  slug?: string;
  parent?: number;
  status?: string;
  link?: string;
};

function createAuthorizationHeader(username: string, applicationPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64")}`;
}

function safePage(value: unknown): WordPressPage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const page = value as WordPressPage;
  return {
    id: typeof page.id === "number" ? page.id : undefined,
    slug: typeof page.slug === "string" ? page.slug : undefined,
    parent: typeof page.parent === "number" ? page.parent : undefined,
    status: typeof page.status === "string" ? page.status : undefined,
    link: typeof page.link === "string" ? page.link : undefined,
  };
}

function safeError(value: unknown): { code?: string; message?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = value as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    confirm?: string;
    wordpressObjectId?: string;
  } | null;

  if (body?.confirm !== "RUN_WORDPRESS_PUBLISH_DIAGNOSTIC") {
    return NextResponse.json({ error: "Explicit diagnostic confirmation is required." }, { status: 400 });
  }

  if (!body?.wordpressObjectId || !/^[1-9]\d*$/.test(body.wordpressObjectId.trim())) {
    return NextResponse.json({ error: "Exact numeric wordpressObjectId is required." }, { status: 400 });
  }

  const wordpressObjectId = Number(body.wordpressObjectId.trim());
  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (
    !site
    || site.organizationId !== scope.organizationId
    || (scope.siteId && scope.siteId !== site.siteId)
  ) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const configuredApiBaseUrl = site.integrations.wordpressApiBaseUrl;
  const credentialReference = site.integrations.wordpressCredentialReference;
  if (!configuredApiBaseUrl || !credentialReference) {
    return NextResponse.json({ error: "WordPress API or credential reference is not configured." }, { status: 409 });
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = normalizeWordPressApiBaseUrl(configuredApiBaseUrl);
  } catch {
    return NextResponse.json({ error: "Configured WordPress API target is invalid." }, { status: 409 });
  }

  const credential = resolveWordPressCredentialReference(credentialReference);
  if (!credential) {
    return NextResponse.json({ error: "WordPress credential reference could not be resolved." }, { status: 409 });
  }

  const authorization = createAuthorizationHeader(credential.username, credential.applicationPassword);
  const pageUrl = `${apiBaseUrl}/pages/${wordpressObjectId}`;
  const readUrl = `${pageUrl}?context=edit&_fields=id,slug,parent,status,link`;

  let beforeResponse: Response;
  try {
    beforeResponse = await fetch(readUrl, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "Pre-read request failed." }, { status: 502 });
  }

  const beforeBody = await beforeResponse.json().catch(() => null);
  if (!beforeResponse.ok) {
    return NextResponse.json({
      diagnosticPerformed: false,
      wordpressObjectId,
      before: { httpStatus: beforeResponse.status, page: safePage(beforeBody), error: safeError(beforeBody) },
    }, { status: 502 });
  }

  const beforePage = safePage(beforeBody);
  if (!beforePage || beforePage.id !== wordpressObjectId) {
    return NextResponse.json({
      diagnosticPerformed: false,
      wordpressObjectId,
      before: { httpStatus: beforeResponse.status, page: beforePage },
      error: "Pre-read identity mismatch.",
    }, { status: 409 });
  }

  if (beforePage.status !== "draft") {
    return NextResponse.json({
      diagnosticPerformed: false,
      wordpressObjectId,
      before: { httpStatus: beforeResponse.status, page: beforePage },
      error: "Diagnostic requires an exact WordPress draft and will not mutate non-draft content.",
    }, { status: 409 });
  }

  let writeResponse: Response;
  try {
    writeResponse = await fetch(pageUrl, {
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
    return NextResponse.json({ error: "Publish diagnostic write request failed." }, { status: 502 });
  }

  const writeBody = await writeResponse.json().catch(() => null);

  let afterResponse: Response;
  try {
    afterResponse = await fetch(readUrl, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({
      diagnosticPerformed: true,
      wordpressObjectId,
      before: { httpStatus: beforeResponse.status, page: beforePage },
      write: {
        httpStatus: writeResponse.status,
        ok: writeResponse.ok,
        page: safePage(writeBody),
        error: safeError(writeBody),
      },
      after: { error: "Read-back request failed." },
    }, { status: 200 });
  }

  const afterBody = await afterResponse.json().catch(() => null);

  return NextResponse.json({
    diagnosticPerformed: true,
    wordpressObjectId,
    before: {
      httpStatus: beforeResponse.status,
      page: beforePage,
    },
    write: {
      httpStatus: writeResponse.status,
      ok: writeResponse.ok,
      page: safePage(writeBody),
      error: safeError(writeBody),
    },
    after: {
      httpStatus: afterResponse.status,
      ok: afterResponse.ok,
      page: safePage(afterBody),
      error: safeError(afterBody),
    },
    verification: {
      sameObject: safePage(afterBody)?.id === wordpressObjectId,
      published: safePage(afterBody)?.status === "publish",
    },
  });
}
