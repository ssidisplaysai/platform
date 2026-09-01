import "server-only";

import type {
  GlwEnrichmentLink,
  GlwEnrichmentSource,
} from "./site-enrichment-authority";
import {
  getGlwSiteEnrichmentRecord,
  type GlwResearchRequirement,
} from "./site-enrichment-repository";
import type {
  GlwResearchAcquisition,
  GlwResearchExecutionRequest,
  GlwResearchProvider,
} from "./site-enrichment-research-executor";

export const GLW_N8N_RESEARCH_WORKFLOW_NAME =
  "GLW Enrichment Research Provider v1";
export const GLW_N8N_RESEARCH_WORKFLOW_ID =
  "E3ZgpwAu98DwpUzO";
export const GLW_N8N_RESEARCH_WEBHOOK_HOST =
  "ssiai.app.n8n.cloud";
export const GLW_N8N_RESEARCH_WEBHOOK_PATH =
  "/webhook/glw-enrichment-research-provider-v1";

export type GlwAllowedInternalLink = {
  href: string;
  anchorText: string;
  authorityClass: "product" | "geography";
};

export type GlwN8nResearchPayload = {
  workflowId: typeof GLW_N8N_RESEARCH_WORKFLOW_ID;
  identity: GlwResearchExecutionRequest;
  request: GlwResearchExecutionRequest;
  researchRequirements: readonly GlwResearchRequirement[];
  upstreamAuthorityDomains: readonly string[];
  allowedInternalLinks: readonly GlwAllowedInternalLink[];
};

export type GlwN8nResearchTransport = {
  execute(input: {
    workflowId: typeof GLW_N8N_RESEARCH_WORKFLOW_ID;
    payload: GlwN8nResearchPayload;
    signal: AbortSignal;
  }): Promise<unknown>;
};

type Configuration = {
  webhookUrl: string;
  webhookSecret: string;
  timeoutMs: number;
};

function normalizedDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\.$/, "");
}

function urlDomain(value: string): string | null {
  try {
    return normalizedDomain(new URL(value).hostname);
  } catch {
    return null;
  }
}

function readConfiguration(
  environment: NodeJS.ProcessEnv,
): Configuration | null {
  const webhookUrl =
    environment.GLW_N8N_RESEARCH_WEBHOOK_URL?.trim()
    ?? "";
  const webhookSecret =
    environment.GLW_N8N_RESEARCH_WEBHOOK_SECRET?.trim()
    ?? "";

  if (!webhookUrl || !webhookSecret) return null;

  const url = new URL(webhookUrl);
  if (url.protocol !== "https:") {
    throw new Error(
      "GLW n8n research webhook must use HTTPS.",
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname !== GLW_N8N_RESEARCH_WEBHOOK_HOST
    || url.pathname !== GLW_N8N_RESEARCH_WEBHOOK_PATH
    || Boolean(url.username)
    || Boolean(url.password)
    || Boolean(url.search)
    || Boolean(url.hash)
  ) {
    throw new Error(
      "GLW n8n research webhook target does not match the approved endpoint.",
    );
  }
  const parsedTimeout = Number(
    environment.GLW_N8N_RESEARCH_TIMEOUT_MS
    ?? 120_000,
  );
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.min(Math.max(parsedTimeout, 1_000), 300_000)
    : 120_000;

  return {
    webhookUrl: url.toString(),
    webhookSecret,
    timeoutMs,
  };
}

function createWebhookTransport(input: {
  environment: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
}): GlwN8nResearchTransport {
  return {
    async execute({ payload, signal }) {
      const configuration =
        readConfiguration(input.environment);
      if (!configuration) {
        throw new Error(
          "GLW n8n research provider is not configured.",
        );
      }

      const response = await input.fetchImpl(
        configuration.webhookUrl,
        {
          method: "POST",
          headers: {
            "X-Genesis-Research-Authorization":
              configuration.webhookSecret,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Genesis-Workflow-Id":
              GLW_N8N_RESEARCH_WORKFLOW_ID,
          },
          body: JSON.stringify(payload),
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );

      const body =
        await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          `n8n research execution failed with HTTP ${response.status}.`,
        );
      }

      return body;
    },
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function unwrapAcquisition(value: unknown): unknown {
  let current = parseJson(value);

  for (let depth = 0; depth < 5; depth += 1) {
    if (
      !current
      || typeof current !== "object"
      || Array.isArray(current)
    ) {
      break;
    }

    const record = current as Record<string, unknown>;
    if (
      "organizationId" in record
      && "sources" in record
      && "fulfillment" in record
    ) {
      return record;
    }

    const next =
      record.output
      ?? record.response
      ?? record.data
      ?? record.text;
    if (next === undefined) break;
    current = parseJson(next);
  }

  throw new Error(
    "n8n research provider returned a malformed response.",
  );
}

function assertIdentity(
  request: GlwResearchExecutionRequest,
  value: Record<string, unknown>,
): void {
  const expected: Record<string, string> = {
    organizationId: request.organizationId,
    siteId: request.siteId,
    campaignId: request.campaignId,
    productId: request.productId,
    stateCode: request.stateCode.trim().toUpperCase(),
    canonicalPath: request.canonicalPath,
    jobId: request.jobId,
    wordpressObjectId: request.wordpressObjectId,
  };

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) {
      throw new Error(
        "n8n research provider returned a mismatched execution identity.",
      );
    }
  }
}

function assertSources(
  value: unknown,
): readonly GlwEnrichmentSource[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "n8n research provider returned malformed sources.",
    );
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error(
        "n8n research provider returned malformed sources.",
      );
    }
    const source = item as Record<string, unknown>;
    const sourceId = String(source.sourceId ?? "").trim();
    const url = String(source.url ?? "").trim();
    const domain = String(source.domain ?? "").trim();
    if (
      !sourceId
      || ids.has(sourceId)
      || !url.startsWith("https://")
      || urlDomain(url) !== normalizedDomain(domain)
      || !String(source.title ?? "").trim()
      || !String(source.publisher ?? "").trim()
      || !String(source.retrievedAt ?? "").trim()
    ) {
      throw new Error(
        "n8n research provider returned an invalid source.",
      );
    }
    ids.add(sourceId);
  }

  return value as readonly GlwEnrichmentSource[];
}

function assertClaims(
  value: unknown,
  sourceIds: ReadonlySet<string>,
): void {
  if (!Array.isArray(value)) {
    throw new Error(
      "n8n research provider returned malformed claims.",
    );
  }

  const ids = new Set<string>();
  for (const item of value) {
    const claim = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    const claimId = String(claim.claimId ?? "").trim();
    const evidence = claim.evidenceSourceIds;
    if (
      !claimId
      || ids.has(claimId)
      || !String(claim.statement ?? "").trim()
      || !Array.isArray(evidence)
      || evidence.length === 0
      || evidence.some(
        (sourceId) =>
          typeof sourceId !== "string"
          || !sourceIds.has(sourceId),
      )
    ) {
      throw new Error(
        "n8n research provider returned an unsupported claim.",
      );
    }
    ids.add(claimId);
  }
}

function assertLinks(
  value: unknown,
  sourceIds: ReadonlySet<string>,
  allowedInternalLinks:
    readonly GlwAllowedInternalLink[],
): void {
  if (!Array.isArray(value)) {
    throw new Error(
      "n8n research provider returned malformed links.",
    );
  }

  const allowedInternalHrefs =
    new Set(
      allowedInternalLinks.map(
        (link) => link.href,
      ),
    );
  const ids = new Set<string>();

  for (const item of value) {
    const link = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    const linkId = String(link.linkId ?? "").trim();
    const kind = String(link.kind ?? "");
    const href = String(link.href ?? "").trim();
    const sourceId = link.sourceId;

    if (
      !linkId
      || ids.has(linkId)
      || !href
      || !String(link.anchorText ?? "").trim()
    ) {
      throw new Error(
        "n8n research provider returned an invalid link.",
      );
    }

    if (
      kind === "internal"
      && (
        !href.startsWith("/")
        || href.startsWith("//")
        || !allowedInternalHrefs.has(href)
      )
    ) {
      throw new Error(
        "n8n research provider returned an unapproved internal link.",
      );
    }

    if (
      kind !== "internal"
      && (
        !href.startsWith("https://")
        || typeof sourceId !== "string"
        || !sourceIds.has(sourceId)
      )
    ) {
      throw new Error(
        "n8n research provider returned an invalid external link.",
      );
    }

    ids.add(linkId);
  }
}

function normalizeAcquisition(input: {
  value: unknown;
  request: GlwResearchExecutionRequest;
  requirements: readonly GlwResearchRequirement[];
  allowedInternalLinks:
    readonly GlwAllowedInternalLink[];
}): GlwResearchAcquisition {
  const value = (
    unwrapAcquisition(input.value)
  ) as Record<string, unknown>;
  assertIdentity(input.request, value);

  const sources = assertSources(value.sources);
  const sourceIds =
    new Set(sources.map((source) => source.sourceId));
  assertClaims(value.claims, sourceIds);
  assertLinks(
    value.links,
    sourceIds,
    input.allowedInternalLinks,
  );

  if (
    !value.fulfillment
    || typeof value.fulfillment !== "object"
    || Array.isArray(value.fulfillment)
  ) {
    throw new Error(
      "n8n research provider returned malformed requirement fulfillment.",
    );
  }

  const knownRequirementIds =
    new Set(
      input.requirements.map(
        (requirement) => requirement.requirementId,
      ),
    );
  for (const requirementId of Object.keys(value.fulfillment)) {
    if (!knownRequirementIds.has(requirementId)) {
      throw new Error(
        "n8n research provider returned unknown requirement fulfillment.",
      );
    }
  }

  return value as GlwResearchAcquisition;
}

function assertRecordIdentity(
  request: GlwResearchExecutionRequest,
  record: NonNullable<
    ReturnType<typeof getGlwSiteEnrichmentRecord>
  >,
): void {
  if (
    record.organizationId !== request.organizationId
    || record.siteId !== request.siteId
    || record.campaignId !== request.campaignId
    || record.productId !== request.productId
    || record.stateCode
      !== request.stateCode.trim().toUpperCase()
    || record.canonicalPath !== request.canonicalPath
    || record.jobId !== request.jobId
    || record.wordpressObjectId
      !== request.wordpressObjectId
  ) {
    throw new Error(
      "n8n research request does not match the persisted work item.",
    );
  }
}

export function createGlwN8nResearchProvider(input?: {
  environment?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  transport?: GlwN8nResearchTransport;
  resolveAllowedInternalLinks?: (
    request: GlwResearchExecutionRequest,
  ) => readonly GlwAllowedInternalLink[];
}): GlwResearchProvider {
  const environment = input?.environment ?? process.env;
  const transport = input?.transport
    ?? createWebhookTransport({
      environment,
      fetchImpl: input?.fetchImpl ?? fetch,
    });
  const parsedTimeout = Number(
    environment.GLW_N8N_RESEARCH_TIMEOUT_MS
    ?? 120_000,
  );
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.min(Math.max(parsedTimeout, 1_000), 300_000)
    : 120_000;

  return {
    async research(request) {
      const record =
        getGlwSiteEnrichmentRecord({
          siteId: request.siteId,
          canonicalPath: request.canonicalPath,
        });
      if (!record) {
        throw new Error(
          "n8n research work item was not found.",
        );
      }
      assertRecordIdentity(request, record);

      const allowedInternalLinks =
        input?.resolveAllowedInternalLinks?.(request)
        ?? record.plan.links
          .filter(
            (link): link is GlwEnrichmentLink & {
              kind: "internal";
            } => link.kind === "internal",
          )
          .map((link) => ({
            href: link.href,
            anchorText: link.anchorText,
            authorityClass: "product" as const,
          }));

      const payload: GlwN8nResearchPayload = {
        workflowId: GLW_N8N_RESEARCH_WORKFLOW_ID,
        identity: { ...request },
        request: { ...request },
        researchRequirements:
          record.researchRequirements,
        upstreamAuthorityDomains:
          record.upstreamAuthorityDomains,
        allowedInternalLinks,
      };
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs,
      );

      try {
        const response = await transport.execute({
          workflowId: GLW_N8N_RESEARCH_WORKFLOW_ID,
          payload,
          signal: controller.signal,
        });
        return normalizeAcquisition({
          value: response,
          request,
          requirements:
            record.researchRequirements,
          allowedInternalLinks,
        });
      } catch (error) {
        if (
          controller.signal.aborted
          || (
            error instanceof DOMException
            && error.name === "AbortError"
          )
        ) {
          throw new Error(
            "n8n research execution timed out.",
          );
        }
        if (error instanceof Error) throw error;
        throw new Error(
          "n8n research execution failed.",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
