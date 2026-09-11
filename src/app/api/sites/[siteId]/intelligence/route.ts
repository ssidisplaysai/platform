import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getSiteById } from "@/modules/foundation/site-repository";
import { evaluateProfileReadiness, getIntegrationProfileById } from "@/modules/foundation/integration-profile-repository";
import { createSiteIntelligenceN8nProvider, getSiteIntelligenceProviderStatus } from "@/modules/foundation/site-intelligence-n8n-provider";
import { executeSiteIntelligenceResearch } from "@/modules/foundation/site-intelligence-research-executor";
import {
  addCreativeInput,
  addCreativeProposal,
  addInitialStrategyProposal,
  addStrategyProposal,
  approveSiteIntelligence,
  classifyCreativeInput,
  decideCreativeProposal,
  decideSiteOpportunity,
  decideStrategy,
  ensureSiteIntelligenceWorkspace,
  getSiteIntelligenceWorkspace,
  getStrategyReadiness,
  recordSiteOpportunity,
  startSiteIntelligence,
  updateCreativeInputMetadata,
  validateOpportunityCapability,
} from "@/modules/foundation/site-intelligence-repository";
import { synthesizeInitialSiteStrategy } from "@/modules/foundation/site-strategy-synthesizer";
import type { CreativeInput, SiteAssetClassification } from "@/modules/foundation/site-intelligence";

type Context = { params: Promise<{ siteId: string }> };
const CLASSIFICATIONS = new Set<SiteAssetClassification>(["OWNER_APPROVED_PUBLISHABLE", "OWNER_SUPPLIED_REFERENCE", "EXTERNAL_INSPIRATION_ONLY", "COMPETITOR_REFERENCE_ONLY", "UNVERIFIED", "REJECTED"]);
const SENTIMENTS = new Set<CreativeInput["sentiment"]>(["LIKE", "DISLIKE", "REFERENCE_ONLY"]);

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "SITE_INTELLIGENCE_REQUEST_FAILED";
  const conflict = message.includes("conflict") || message.includes("CONFLICT");
  return NextResponse.json({ error: message }, { status: conflict ? 409 : 422 });
}

async function scopedSite(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return null;
  return site;
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scopedSite(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const workspace = getSiteIntelligenceWorkspace(site.siteId);
  return NextResponse.json({
    site: { siteId: site.siteId, organizationId: site.organizationId, displayName: site.displayName, publicationPolicy: site.publicationPolicy, enabled: site.enabled },
    workspace,
    strategyReadiness: workspace ? getStrategyReadiness(workspace) : { ready: false, blockers: ["Complete and approve Site Intelligence review."], approvedOpportunityCount: 0, verifiedCapabilityCount: 0, qualifiedCapabilityCount: 0 },
    startBoundary: "START_SITE_INTELLIGENCE",
    provider: getSiteIntelligenceProviderStatus(),
  });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scopedSite(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const common = {
    siteId: site.siteId,
    organizationId: site.organizationId,
    expectedRevision: Number(body.expectedRevision),
    actor: String(body.actor ?? "site-owner"),
    reason: String(body.reason ?? "Owner action through Site Intelligence workspace."),
  };

  try {
    let workspace;
    switch (action) {
      case "START": {
        const status = getSiteIntelligenceProviderStatus(); if (!status.configured) return NextResponse.json({ error: "SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED" }, { status: 503 });
        const profileIds = [site.profiles.brandProfileReference, site.profiles.seoProfileReference, site.profiles.promptProfileReference, site.profiles.imageProfileReference];
        if (profileIds.some((id) => !id || !evaluateProfileReadiness(id)?.ready)) return NextResponse.json({ error: "SITE_INTELLIGENCE_PROFILE_AUTHORITY_NOT_READY" }, { status: 422 });
        const brand = getIntegrationProfileById(site.profiles.brandProfileReference!);
        const created = ensureSiteIntelligenceWorkspace({ organizationId: site.organizationId, siteId: site.siteId, publicBrandIdentity: String(body.publicBrandIdentity ?? site.displayName), actor: common.actor });
        const started = created.intelligenceState === "INTELLIGENCE_NOT_STARTED" ? startSiteIntelligence({ ...common, expectedRevision: created.revision, providerReference: status.providerId }) : created;
        workspace = await executeSiteIntelligenceResearch({ expectedRevision: started.revision, actor: common.actor, provider: createSiteIntelligenceN8nProvider(), authority: { organizationId: site.organizationId, siteId: site.siteId, domain: site.domain!, publicBrandIdentity: brand?.profileName.split(/\s+[—-]\s+/)[0] ?? site.displayName, brandProfileId: site.profiles.brandProfileReference!, seoProfileId: site.profiles.seoProfileReference!, promptProfileId: site.profiles.promptProfileReference!, imageProfileId: site.profiles.imageProfileReference! } });
        break;
      }
      case "RESEARCH_MORE": {
        const current = getSiteIntelligenceWorkspace(site.siteId); if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
        const opportunityId = String(body.opportunityId); const status = getSiteIntelligenceProviderStatus(); if (!status.configured) return NextResponse.json({ error: "SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED" }, { status: 503 });
        workspace = decideSiteOpportunity({ ...common, opportunityId, decision: "RESEARCH_MORE" });
        const brand = getIntegrationProfileById(site.profiles.brandProfileReference!);
        workspace = await executeSiteIntelligenceResearch({ expectedRevision: workspace.revision, actor: common.actor, focusOpportunityId: opportunityId, provider: createSiteIntelligenceN8nProvider(), authority: { organizationId: site.organizationId, siteId: site.siteId, domain: site.domain!, publicBrandIdentity: brand?.profileName.split(/\s+[—-]\s+/)[0] ?? site.displayName, brandProfileId: site.profiles.brandProfileReference!, seoProfileId: site.profiles.seoProfileReference!, promptProfileId: site.profiles.promptProfileReference!, imageProfileId: site.profiles.imageProfileReference! } });
        break;
      }
      case "RETRY_RESEARCH": {
        const current = getSiteIntelligenceWorkspace(site.siteId); if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
        const execution = (current.researchExecutions ?? []).find((candidate) => candidate.kind === "INITIAL");
        if (!execution || execution.state !== "RECOVERABLE") throw new Error("RESEARCH_EXECUTION_NOT_RECOVERABLE");
        const status = getSiteIntelligenceProviderStatus(); if (!status.configured) return NextResponse.json({ error: "SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED" }, { status: 503 });
        const profileIds = [site.profiles.brandProfileReference, site.profiles.seoProfileReference, site.profiles.promptProfileReference, site.profiles.imageProfileReference];
        if (profileIds.some((id) => !id || !evaluateProfileReadiness(id)?.ready)) return NextResponse.json({ error: "SITE_INTELLIGENCE_PROFILE_AUTHORITY_NOT_READY" }, { status: 422 });
        const brand = getIntegrationProfileById(site.profiles.brandProfileReference!);
        workspace = await executeSiteIntelligenceResearch({ expectedRevision: current.revision, actor: common.actor, maxAttempts: 1, provider: createSiteIntelligenceN8nProvider(), authority: { organizationId: site.organizationId, siteId: site.siteId, domain: site.domain!, publicBrandIdentity: brand?.profileName.split(/\s+[—-]\s+/)[0] ?? site.displayName, brandProfileId: site.profiles.brandProfileReference!, seoProfileId: site.profiles.seoProfileReference!, promptProfileId: site.profiles.promptProfileReference!, imageProfileId: site.profiles.imageProfileReference! } });
        break;
      }
      case "DECIDE_OPPORTUNITY":
        workspace = decideSiteOpportunity({ ...common, opportunityId: String(body.opportunityId), decision: body.decision as never });
        break;
      case "RECORD_OPPORTUNITY":
        workspace = recordSiteOpportunity({ ...common, opportunity: body.opportunity as never, evidence: Array.isArray(body.evidence) ? body.evidence as never : [] });
        break;
      case "VALIDATE_CAPABILITY":
        workspace = validateOpportunityCapability({ ...common, opportunityId: String(body.opportunityId), state: body.state as never, evidenceIds: Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : [], notes: String(body.notes ?? "") });
        break;
      case "APPROVE_INTELLIGENCE":
        workspace = approveSiteIntelligence(common);
        break;
      case "PROPOSE_STRATEGY":
        workspace = addStrategyProposal({ ...common, proposal: body.proposal as never });
        break;
      case "GENERATE_STRATEGY": {
        const current = getSiteIntelligenceWorkspace(site.siteId); if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
        const readiness = getStrategyReadiness(current); if (!readiness.ready) throw new Error(`STRATEGY_NOT_READY:${readiness.blockers.join("|")}`);
        const brandProfile = site.profiles.brandProfileReference ? getIntegrationProfileById(site.profiles.brandProfileReference) : null;
        const seoProfile = site.profiles.seoProfileReference ? getIntegrationProfileById(site.profiles.seoProfileReference) : null;
        const promptProfile = site.profiles.promptProfileReference ? getIntegrationProfileById(site.profiles.promptProfileReference) : null;
        if (!brandProfile || !seoProfile || !promptProfile || !evaluateProfileReadiness(brandProfile.profileId)?.ready || !evaluateProfileReadiness(seoProfile.profileId)?.ready || !evaluateProfileReadiness(promptProfile.profileId)?.ready) throw new Error("STRATEGY_PROFILE_AUTHORITY_NOT_READY");
        const proposal = synthesizeInitialSiteStrategy(current, { domain: site.domain!, publicBrandIdentity: current.publicBrandIdentity, brandProfile, seoProfile, promptProfile });
        workspace = addInitialStrategyProposal({ ...common, expectedRevision: current.revision, proposal, reason: "Genesis synthesized the first Site Strategy proposal from approved intelligence and scoped profile authority." });
        break;
      }
      case "DECIDE_STRATEGY":
        workspace = decideStrategy({ ...common, decision: body.decision as never });
        break;
      case "ADD_CREATIVE_INPUT":
        workspace = addCreativeInput({ ...common, creativeInput: body.creativeInput as never });
        break;
      case "ADD_URL_REFERENCE": {
        const classification = String(body.classification) as SiteAssetClassification;
        const sentiment = String(body.sentiment) as CreativeInput["sentiment"];
        if (!CLASSIFICATIONS.has(classification) || !SENTIMENTS.has(sentiment)) throw new Error("CREATIVE_INPUT_METADATA_INVALID");
        const existing = getSiteIntelligenceWorkspace(site.siteId);
        const brand = site.profiles.brandProfileReference ? getIntegrationProfileById(site.profiles.brandProfileReference) : null;
        const base = existing ?? ensureSiteIntelligenceWorkspace({ organizationId: site.organizationId, siteId: site.siteId, publicBrandIdentity: brand?.organizationId === site.organizationId ? brand.profileName.split(/\s+[—-]\s+/)[0] : site.displayName, actor: common.actor });
        workspace = addCreativeInput({ ...common, expectedRevision: base.revision, creativeInput: { inputId: `creative-input-${randomUUID()}`, kind: "URL", reference: String(body.reference ?? ""), sentiment, classification, notes: body.notes === null ? null : String(body.notes ?? ""), suppliedBy: common.actor, suppliedAt: new Date().toISOString(), binaryAsset: null } });
        break;
      }
      case "CLASSIFY_CREATIVE_INPUT":
        workspace = classifyCreativeInput({ ...common, inputId: String(body.inputId), classification: body.classification as never });
        break;
      case "UPDATE_CREATIVE_INPUT": {
        const classification = body.classification === undefined ? undefined : String(body.classification) as SiteAssetClassification;
        const sentiment = body.sentiment === undefined ? undefined : String(body.sentiment) as CreativeInput["sentiment"];
        if ((classification !== undefined && !CLASSIFICATIONS.has(classification)) || (sentiment !== undefined && !SENTIMENTS.has(sentiment))) throw new Error("CREATIVE_INPUT_METADATA_INVALID");
        workspace = updateCreativeInputMetadata({ ...common, inputId: String(body.inputId), reference: body.reference === undefined ? undefined : String(body.reference), classification, sentiment, notes: body.notes === undefined ? undefined : body.notes === null ? null : String(body.notes) });
        break;
      }
      case "PROPOSE_CREATIVE":
        workspace = addCreativeProposal({ ...common, proposal: body.proposal as never });
        break;
      case "DECIDE_CREATIVE":
        workspace = decideCreativeProposal({ ...common, decision: body.decision as never });
        break;
      default:
        return NextResponse.json({ error: "Unsupported intelligence action." }, { status: 400 });
    }
    return NextResponse.json({ workspace });
  } catch (error) {
    return errorResponse(error);
  }
}