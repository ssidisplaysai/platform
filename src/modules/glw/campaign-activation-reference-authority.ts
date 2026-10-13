import "server-only";

import { createHash } from "node:crypto";
import type { GlwCampaignTarget } from "@/modules/glw/campaign-target-repository";
import type { GlwCampaignReferenceApproval } from "@/modules/glw/campaign-reference-approval-repository";
import type { GlwCertifiedStateTarget } from "@/modules/glw/campaign-certified-state-targets";

export type GlwActivationReferenceApprovalAuthority = {
  receiptSha256: string;
  referenceRevision: number;
  imageCandidateId: string;
  imageCandidateRevision: number;
};

export type GlwStateServiceActivationReferenceAuthority = {
  approvedReferenceCount: 0 | 1;
  source: "WORDPRESS_DRAFT" | "PUBLIC_CERTIFIED" | null;
  referenceApproval: GlwActivationReferenceApprovalAuthority | null;
};

type WordPressDraftApproval = Extract<GlwCampaignReferenceApproval, { approvalKind?: "WORDPRESS_DRAFT" }>;

function normalizeStateCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function approvalIdentityHash(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
}): string {
  return createHash("sha256").update(JSON.stringify({
    contract: "GLW_WORDPRESS_DRAFT_REFERENCE_APPROVAL_RECEIPT_V1",
    campaignId: input.campaignId,
    stateCode: normalizeStateCode(input.stateCode),
    citySlug: normalizeCitySlug(input.citySlug),
    jobId: input.jobId,
    wordpressObjectId: input.wordpressObjectId,
  })).digest("hex");
}

export function referenceApprovalMatchesTargetIdentity(input: {
  approval: GlwCampaignReferenceApproval | null;
  stateCode: string;
  citySlug?: string | null;
  target: Pick<GlwCampaignTarget, "jobId" | "wordpressObjectId"> | null;
}): input is {
  approval: WordPressDraftApproval;
  stateCode: string;
  citySlug?: string | null;
  target: Pick<GlwCampaignTarget, "jobId" | "wordpressObjectId">;
} {
  if (!input.approval || input.approval.approvalKind === "GOVERNED_LOCAL_REFERENCE" || !input.target) return false;
  return normalizeStateCode(input.approval.stateCode) === normalizeStateCode(input.stateCode)
    && normalizeCitySlug(input.approval.citySlug) === normalizeCitySlug(input.citySlug)
    && input.approval.jobId === input.target.jobId
    && input.approval.wordpressObjectId === input.target.wordpressObjectId
    && Boolean(input.approval.jobId)
    && Boolean(input.approval.wordpressObjectId);
}

export function buildWordpressDraftReferenceApprovalAuthority(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
}): GlwActivationReferenceApprovalAuthority {
  return {
    receiptSha256: approvalIdentityHash(input),
    referenceRevision: 1,
    imageCandidateId: `wordpress-draft:${input.wordpressObjectId}`,
    imageCandidateRevision: 1,
  };
}

export function buildPublicCertifiedReferenceApprovalAuthority(certifiedReference: GlwCertifiedStateTarget): GlwActivationReferenceApprovalAuthority {
  return {
    receiptSha256: certifiedReference.evidenceFingerprint,
    referenceRevision: 1,
    imageCandidateId: certifiedReference.certificationId,
    imageCandidateRevision: 1,
  };
}

export function resolveStateServiceActivationReferenceAuthority(input: {
  campaignId: string;
  stateCode: string;
  selectedTarget: Pick<GlwCampaignTarget, "jobId" | "wordpressObjectId"> | null;
  draftApproval: GlwCampaignReferenceApproval | null;
  publicCertifiedReference: GlwCertifiedStateTarget | null;
}): GlwStateServiceActivationReferenceAuthority {
  if (referenceApprovalMatchesTargetIdentity({
    approval: input.draftApproval,
    stateCode: input.stateCode,
    citySlug: null,
    target: input.selectedTarget,
  })) {
    return {
      approvedReferenceCount: 1,
      source: "WORDPRESS_DRAFT",
      referenceApproval: buildWordpressDraftReferenceApprovalAuthority({
        campaignId: input.campaignId,
        stateCode: input.stateCode,
        citySlug: null,
        jobId: input.draftApproval.jobId,
        wordpressObjectId: input.draftApproval.wordpressObjectId,
      }),
    };
  }

  if (input.publicCertifiedReference) {
    return {
      approvedReferenceCount: 1,
      source: "PUBLIC_CERTIFIED",
      referenceApproval: buildPublicCertifiedReferenceApprovalAuthority(input.publicCertifiedReference),
    };
  }

  return {
    approvedReferenceCount: 0,
    source: null,
    referenceApproval: null,
  };
}
