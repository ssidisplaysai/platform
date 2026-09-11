import "server-only";

import { evaluateGenerationReadiness } from "./site-generation-readiness";
import { getGenerationCertification, getSiteBuildSession } from "./site-generation-readiness-repository";
import { getSiteIntelligenceWorkspace } from "./site-intelligence-repository";
import { getSiteAuthorityWorkspace } from "./site-product-authority-repository";
import type { SiteConfiguration } from "./types";

export function getSiteGenerationReadiness(site: SiteConfiguration) {
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
  const authority = strategy
    ? getSiteAuthorityWorkspace({ organizationId: site.organizationId, siteId: site.siteId, strategy })
    : { sources: [], candidates: [], progress: { proposed: 0, approved: 0, needReview: 0 } };
  const readiness = evaluateGenerationReadiness({ site, intelligence, sources: authority.sources, candidates: authority.candidates });
  const storedCertification = getGenerationCertification({ organizationId: site.organizationId, siteId: site.siteId, snapshot: readiness.snapshot });
  const certification = storedCertification.status === "CURRENT" && !readiness.readyToCertify
    ? { ...storedCertification, status: "STALE" as const }
    : storedCertification;
  const buildSession = getSiteBuildSession({ organizationId: site.organizationId, siteId: site.siteId });
  return { readiness, certification, buildSession, authority };
}