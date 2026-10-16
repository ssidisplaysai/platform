import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  applyAutoPreparedProfileOverrides,
  buildNewProfileFromAutoPreparedProposal,
  createAutoPreparedProfilesPreview,
  type AutoPreparedProfileOverride,
} from "@/modules/foundation/onboarding-auto-profile-preparation";
import {
  createIntegrationProfile,
  evaluateProfileReadiness,
  getIntegrationProfileById,
  listIntegrationProfiles,
  upsertProfileAssignment,
  updateIntegrationProfile,
} from "@/modules/foundation/integration-profile-repository";
import { getSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
const APPROVAL_CONFIRMATION = "APPROVE_AUTO_PREPARE_PROFILES";

async function scopedSite(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  if (!site || !hasOrganizationScope(scope) || !isRecordInScope({
    recordOrganizationId: site.organizationId,
    recordSiteId: site.siteId,
    scope,
  })) {
    return null;
  }
  return site;
}

function likedCreativeAssetIds(siteId: string): string[] {
  const workspace = getSiteIntelligenceWorkspace(siteId);
  if (!workspace) {
    return [];
  }
  return workspace.creativeInputs
    .filter((input) => (
      input.sentiment === "LIKE"
      && input.classification === "OWNER_SUPPLIED_REFERENCE"
      && Boolean(input.binaryAsset?.assetId)
    ))
    .map((input) => String(input.binaryAsset?.assetId));
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const site = await scopedSite(request, context);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as {
    action?: "PREVIEW" | "APPLY";
    confirm?: string;
    fingerprint?: string;
    overrides?: AutoPreparedProfileOverride[];
  } | null;
  const action = body?.action ?? "PREVIEW";

  const organizationProfiles = listIntegrationProfiles({
    organizationId: site.organizationId,
    enabled: true,
  });
  const preview = createAutoPreparedProfilesPreview({
    site,
    organizationProfiles,
    likedCreativeAssetIds: likedCreativeAssetIds(site.siteId),
  });

  if (action === "PREVIEW") {
    return NextResponse.json({
      preview,
      confirmationRequired: APPROVAL_CONFIRMATION,
    });
  }

  if (body?.confirm !== APPROVAL_CONFIRMATION) {
    return NextResponse.json({ error: "AUTO_PREPARE_APPROVAL_REQUIRED" }, { status: 400 });
  }
  if (!body?.fingerprint || body.fingerprint !== preview.fingerprint) {
    return NextResponse.json({ error: "AUTO_PREPARE_PREVIEW_OUTDATED" }, { status: 409 });
  }

  const proposals = applyAutoPreparedProfileOverrides({
    preview,
    overrides: body.overrides,
  });
  const blockedProposal = proposals.find((proposal) => (
    proposal.mode === "proposed" && proposal.diagnostics.blockers.length > 0
  ));
  if (blockedProposal) {
    return NextResponse.json({
      error: "AUTO_PREPARE_PROPOSAL_BLOCKED",
      profileType: blockedProposal.profileType,
      blockers: blockedProposal.diagnostics.blockers,
    }, { status: 422 });
  }

  const resolved = {
    brandProfileReference: site.profiles.brandProfileReference,
    seoProfileReference: site.profiles.seoProfileReference,
    promptProfileReference: site.profiles.promptProfileReference,
    imageProfileReference: site.profiles.imageProfileReference,
  };

  for (const proposal of proposals) {
    let profile = getIntegrationProfileById(proposal.profileId);
    if (proposal.mode === "proposed" && !profile) {
      const creation = createIntegrationProfile(
        buildNewProfileFromAutoPreparedProposal({
          organizationId: site.organizationId,
          proposal,
        }),
      );
      if (!creation.validation.valid || !creation.profile) {
        return NextResponse.json({
          error: "AUTO_PREPARE_PROFILE_CREATE_FAILED",
          issues: creation.validation.issues,
          profileType: proposal.profileType,
        }, { status: 422 });
      }
      profile = creation.profile;
    }

    if (!profile) {
      return NextResponse.json({
        error: "AUTO_PREPARE_PROFILE_NOT_FOUND",
        profileType: proposal.profileType,
      }, { status: 422 });
    }
    if (
      profile.organizationId !== site.organizationId
      || profile.profileType !== proposal.profileType
    ) {
      return NextResponse.json({
        error: "AUTO_PREPARE_PROFILE_SCOPE_MISMATCH",
        profileId: profile.profileId,
      }, { status: 403 });
    }

    const readiness = evaluateProfileReadiness(profile.profileId);
    if (!readiness?.ready) {
      return NextResponse.json({
        error: "AUTO_PREPARE_PROFILE_NOT_READY",
        profileId: profile.profileId,
        blockers: readiness?.blockers ?? [],
      }, { status: 422 });
    }

    if (!profile.assignedSiteIds.includes(site.siteId)) {
      const assignedSiteIds = [...new Set([...profile.assignedSiteIds, site.siteId])];
      const updated = updateIntegrationProfile(profile.profileId, { assignedSiteIds });
      if (!updated.validation.valid || !updated.profile) {
        return NextResponse.json({
          error: "AUTO_PREPARE_PROFILE_ASSIGNMENT_FAILED",
          issues: updated.validation.issues,
          profileId: profile.profileId,
        }, { status: 422 });
      }
      profile = updated.profile;
    }

    const assignment = upsertProfileAssignment({
      organizationId: site.organizationId,
      targetType: "site",
      targetId: site.siteId,
      siteId: site.siteId,
      profileType: proposal.profileType,
      profileId: profile.profileId,
      notes: "Auto-prepared during onboarding after explicit owner approval.",
    });
    if (!assignment.validation.valid) {
      return NextResponse.json({
        error: "AUTO_PREPARE_PROFILE_ASSIGNMENT_FAILED",
        issues: assignment.validation.issues,
        profileId: profile.profileId,
      }, { status: 422 });
    }

    if (proposal.profileType === "brand") {
      resolved.brandProfileReference = profile.profileId;
    } else if (proposal.profileType === "seo") {
      resolved.seoProfileReference = profile.profileId;
    } else if (proposal.profileType === "prompt") {
      resolved.promptProfileReference = profile.profileId;
    } else if (proposal.profileType === "image") {
      resolved.imageProfileReference = profile.profileId;
    }
  }

  const updatedSite = updateSite(site.siteId, {
    profiles: {
      ...site.profiles,
      ...resolved,
    },
  });
  if (!updatedSite.validation.valid || !updatedSite.site) {
    return NextResponse.json({
      error: "AUTO_PREPARE_SITE_BINDING_FAILED",
      issues: updatedSite.validation.issues,
    }, { status: 422 });
  }

  return NextResponse.json({
    prepared: true,
    site: updatedSite.site,
    selectedProfiles: {
      seoProfileReference: updatedSite.site.profiles.seoProfileReference ?? "",
      promptProfileReference: updatedSite.site.profiles.promptProfileReference ?? "",
      imageProfileReference: updatedSite.site.profiles.imageProfileReference ?? "",
      brandProfileReference: updatedSite.site.profiles.brandProfileReference ?? "",
      workflowReference: updatedSite.site.integrations.workflowReference ?? "",
    },
    workflowPending: !updatedSite.site.integrations.workflowReference,
  });
}
