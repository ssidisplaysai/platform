import "server-only";

export type GlwEnrichmentSourceTier =
  | "first_party"
  | "government"
  | "tourism_board"
  | "institutional"
  | "reputable_news"
  | "industry";

export type GlwEnrichmentClaimClass =
  | "product"
  | "geography"
  | "application"
  | "market"
  | "context";

export type GlwEnrichmentLinkKind =
  | "internal"
  | "external_authority"
  | "upstream_source_of_truth";

export type GlwEnrichmentStatus =
  | "unenriched"
  | "qa_failed"
  | "enriched";

export type GlwEnrichmentSource = {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  tier: GlwEnrichmentSourceTier;
  publisher: string;
  retrievedAt: string;
};

export type GlwEnrichmentClaim = {
  claimId: string;
  claimClass: GlwEnrichmentClaimClass;
  statement: string;
  evidenceSourceIds: readonly string[];
};

export type GlwEnrichmentLink = {
  linkId: string;
  kind: GlwEnrichmentLinkKind;
  href: string;
  anchorText: string;
  sourceId?: string | null;
};

export type GlwEnrichmentPlan = {
  organizationId: string;
  siteId: string;
  siteDomain: string;
  canonicalPath: string;
  upstreamAuthorityDomains: readonly string[];
  sources: readonly GlwEnrichmentSource[];
  claims: readonly GlwEnrichmentClaim[];
  links: readonly GlwEnrichmentLink[];
};

export type GlwEnrichmentQaCheck = {
  ok: boolean;
  message: string;
};

export type GlwEnrichmentQaResult = {
  ok: boolean;
  status: GlwEnrichmentStatus;
  publicationReadyEligible: boolean;
  checks: {
    uniqueSourceIds: GlwEnrichmentQaCheck;
    sourceUrls: GlwEnrichmentQaCheck;
    claimEvidence: GlwEnrichmentQaCheck;
    productAuthority: GlwEnrichmentQaCheck;
    geographicAuthority: GlwEnrichmentQaCheck;
    internalLinks: GlwEnrichmentQaCheck;
    externalAuthorityLinks: GlwEnrichmentQaCheck;
    upstreamAuthorityLinks: GlwEnrichmentQaCheck;
    linkSourceIntegrity: GlwEnrichmentQaCheck;
  };
  failureReasons: Readonly<Record<string, string>>;
};

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\.$/, "");
}

function normalizedUrlDomain(value: string): string | null {
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return null;
  }
}

function check(
  ok: boolean,
  passMessage: string,
  failureMessage: string,
): GlwEnrichmentQaCheck {
  return {
    ok,
    message: ok ? passMessage : failureMessage,
  };
}

function isGeographicAuthorityTier(
  tier: GlwEnrichmentSourceTier,
): boolean {
  return (
    tier === "government"
    || tier === "tourism_board"
    || tier === "institutional"
    || tier === "reputable_news"
  );
}

export function evaluateGlwEnrichmentPlan(
  input: GlwEnrichmentPlan,
): GlwEnrichmentQaResult {
  const siteDomain = normalizeDomain(input.siteDomain);

  const sourcesById =
    new Map<string, GlwEnrichmentSource>();

  const duplicateSourceIds: string[] = [];

  for (const source of input.sources) {
    if (sourcesById.has(source.sourceId)) {
      duplicateSourceIds.push(source.sourceId);
      continue;
    }

    sourcesById.set(source.sourceId, source);
  }

  const malformedSourceIds =
    input.sources
      .filter((source) => {
        const urlDomain =
          normalizedUrlDomain(source.url);

        return (
          !source.sourceId.trim()
          || !source.title.trim()
          || !source.publisher.trim()
          || !urlDomain
          || normalizeDomain(source.domain) !== urlDomain
          || !source.url.startsWith("https://")
        );
      })
      .map((source) => source.sourceId);

  const unsupportedClaimIds =
    input.claims
      .filter((claim) =>
        claim.evidenceSourceIds.length === 0
        || claim.evidenceSourceIds.some(
          (sourceId) =>
            !sourcesById.has(sourceId),
        ),
      )
      .map((claim) => claim.claimId);

  const weakProductClaimIds =
    input.claims
      .filter(
        (claim) =>
          claim.claimClass === "product"
          && !claim.evidenceSourceIds.some(
            (sourceId) =>
              sourcesById.get(sourceId)?.tier
              === "first_party",
          ),
      )
      .map((claim) => claim.claimId);

  const weakGeographicClaimIds =
    input.claims
      .filter(
        (claim) =>
          claim.claimClass === "geography"
          && !claim.evidenceSourceIds.some(
            (sourceId) => {
              const source =
                sourcesById.get(sourceId);

              return source
                ? isGeographicAuthorityTier(
                    source.tier,
                  )
                : false;
            },
          ),
      )
      .map((claim) => claim.claimId);

  const internalLinks =
    input.links.filter(
      (link) => link.kind === "internal",
    );

  const invalidInternalLinks =
    internalLinks.filter(
      (link) =>
        !link.href.startsWith("/")
        || link.href.startsWith("//")
        || !link.anchorText.trim(),
    );

  const externalAuthorityLinks =
    input.links.filter(
      (link) =>
        link.kind === "external_authority",
    );

  const invalidExternalAuthorityLinks =
    externalAuthorityLinks.filter((link) => {
      const domain =
        normalizedUrlDomain(link.href);

      return (
        !domain
        || !link.href.startsWith("https://")
        || domain === siteDomain
        || !link.anchorText.trim()
      );
    });

  const upstreamAuthorityDomains =
    input.upstreamAuthorityDomains
      .map(normalizeDomain)
      .filter(Boolean);

  const upstreamAuthorityLinks =
    input.links.filter(
      (link) =>
        link.kind
        === "upstream_source_of_truth",
    );

  const validUpstreamAuthorityLinks =
    upstreamAuthorityLinks.filter((link) => {
      const domain =
        normalizedUrlDomain(link.href);

      return (
        Boolean(domain)
        && link.href.startsWith("https://")
        && upstreamAuthorityDomains.includes(
          domain ?? "",
        )
        && Boolean(link.anchorText.trim())
      );
    });

  const linkSourceIntegrityFailures =
    input.links
      .filter(
        (link) =>
          link.kind !== "internal"
          && (
            !link.sourceId
            || !sourcesById.has(link.sourceId)
          ),
      )
      .map((link) => link.linkId);

  const uniqueSourceIds =
    check(
      duplicateSourceIds.length === 0,
      "Evidence source IDs are unique.",
      `Duplicate evidence source IDs: ${duplicateSourceIds.join(", ")}`,
    );

  const sourceUrls =
    check(
      malformedSourceIds.length === 0,
      "Evidence sources use canonical HTTPS URLs with matching domains.",
      `Invalid evidence source records: ${malformedSourceIds.join(", ")}`,
    );

  const claimEvidence =
    check(
      unsupportedClaimIds.length === 0,
      "Every enrichment claim resolves to stored evidence.",
      `Claims without resolvable evidence: ${unsupportedClaimIds.join(", ")}`,
    );

  const productAuthority =
    check(
      weakProductClaimIds.length === 0,
      "Product claims resolve to first-party authority.",
      `Product claims missing first-party authority: ${weakProductClaimIds.join(", ")}`,
    );

  const geographicAuthority =
    check(
      weakGeographicClaimIds.length === 0,
      "Geographic claims resolve to qualified geographic authority.",
      `Geographic claims missing qualified authority: ${weakGeographicClaimIds.join(", ")}`,
    );

  const internalLinkCheck =
    check(
      internalLinks.length >= 2
      && invalidInternalLinks.length === 0,
      "Internal link plan contains at least two valid site-relative links.",
      "At least two valid site-relative internal links are required.",
    );

  const externalAuthorityLinkCheck =
    check(
      externalAuthorityLinks.length >= 1
      && invalidExternalAuthorityLinks.length
        === 0,
      "External authority link plan is valid.",
      "At least one valid external authority link is required.",
    );

  const upstreamAuthorityCheck =
    check(
      upstreamAuthorityDomains.length === 0
      || validUpstreamAuthorityLinks.length
        >= 1,
      upstreamAuthorityDomains.length === 0
        ? "No upstream source-of-truth domain is configured."
        : "Configured upstream source-of-truth authority is linked.",
      "A configured upstream source-of-truth domain must receive at least one valid authority link.",
    );

  const linkSourceIntegrity =
    check(
      linkSourceIntegrityFailures.length === 0,
      "Every external authority link resolves to evidence.",
      `External links without evidence sources: ${linkSourceIntegrityFailures.join(", ")}`,
    );

  const checks = {
    uniqueSourceIds,
    sourceUrls,
    claimEvidence,
    productAuthority,
    geographicAuthority,
    internalLinks: internalLinkCheck,
    externalAuthorityLinks:
      externalAuthorityLinkCheck,
    upstreamAuthorityLinks:
      upstreamAuthorityCheck,
    linkSourceIntegrity,
  };

  const failureReasons =
    Object.fromEntries(
      Object.entries(checks)
        .filter(([, value]) => !value.ok)
        .map(([key, value]) => [
          key,
          value.message,
        ]),
    );

  const ok =
    Object.values(checks).every(
      (value) => value.ok,
    );

  return {
    ok,
    status: ok ? "enriched" : "qa_failed",
    publicationReadyEligible: ok,
    checks,
    failureReasons,
  };
}