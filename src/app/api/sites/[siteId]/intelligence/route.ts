import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { getSiteById } from "@/modules/foundation/site-repository";
import {
  addCreativeInput,
  addCreativeProposal,
  addStrategyProposal,
  approveSiteIntelligence,
  decideCreativeProposal,
  decideSiteOpportunity,
  decideStrategy,
  ensureSiteIntelligenceWorkspace,
  getSiteIntelligenceWorkspace,
  recordSiteOpportunity,
  startSiteIntelligence,
  validateOpportunityCapability,
} from "@/modules/foundation/site-intelligence-repository";

type Context = { params: Promise<{ siteId: string }> };

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
  return NextResponse.json({
    site: { siteId: site.siteId, organizationId: site.organizationId, displayName: site.displayName, publicationPolicy: site.publicationPolicy, enabled: site.enabled },
    workspace: getSiteIntelligenceWorkspace(site.siteId),
    startBoundary: "START_SITE_INTELLIGENCE",
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
        const created = ensureSiteIntelligenceWorkspace({ organizationId: site.organizationId, siteId: site.siteId, publicBrandIdentity: String(body.publicBrandIdentity ?? site.displayName), actor: common.actor });
        workspace = startSiteIntelligence({ ...common, expectedRevision: created.revision, providerReference: String(body.providerReference ?? "provider-bounded-site-research-v1") });
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
      case "DECIDE_STRATEGY":
        workspace = decideStrategy({ ...common, decision: body.decision as never });
        break;
      case "ADD_CREATIVE_INPUT":
        workspace = addCreativeInput({ ...common, creativeInput: body.creativeInput as never });
        break;
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