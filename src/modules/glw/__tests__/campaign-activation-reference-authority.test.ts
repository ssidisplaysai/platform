jest.mock("server-only", () => ({}));

import {
  referenceApprovalMatchesTargetIdentity,
  resolveStateServiceActivationReferenceAuthority,
} from "../campaign-activation-reference-authority";
import type { GlwCampaignReferenceApproval } from "../campaign-reference-approval-repository";
import type { GlwCertifiedStateTarget } from "../campaign-certified-state-targets";

const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2";

function draftApproval(overrides: Partial<Extract<GlwCampaignReferenceApproval, { approvalKind?: "WORDPRESS_DRAFT" }>> = {}): Extract<GlwCampaignReferenceApproval, { approvalKind?: "WORDPRESS_DRAFT" }> {
  return {
    approvalKind: "WORDPRESS_DRAFT",
    campaignId,
    stateCode: "TX",
    citySlug: null,
    jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
    wordpressObjectId: "20240",
    approvedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function certifiedReference(overrides: Partial<GlwCertifiedStateTarget> = {}): GlwCertifiedStateTarget {
  return {
    stateCode: "TX",
    targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2-tx",
    wordpressObjectId: "20240",
    certificationId: "public-certification-1",
    evidenceId: "receipt-1",
    evidenceFingerprint: "a".repeat(64),
    certifiedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("state-service activation reference authority", () => {
  test("state_service + draft_only + exact approved draft reference is eligible with approvedReferenceCount=1", () => {
    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: draftApproval(),
      publicCertifiedReference: null,
    });

    expect(authority.approvedReferenceCount).toBe(1);
    expect(authority.source).toBe("WORDPRESS_DRAFT");
    expect(authority.referenceApproval).not.toBeNull();
  });

  test("state_service remains blocked when no approved draft reference and no public certification exist", () => {
    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: null,
      publicCertifiedReference: null,
    });

    expect(authority.approvedReferenceCount).toBe(0);
    expect(authority.source).toBeNull();
    expect(authority.referenceApproval).toBeNull();
  });

  test("state_service keeps valid PUBLIC_CERTIFIED fallback", () => {
    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: null,
      publicCertifiedReference: certifiedReference(),
    });

    expect(authority.approvedReferenceCount).toBe(1);
    expect(authority.source).toBe("PUBLIC_CERTIFIED");
    expect(authority.referenceApproval?.imageCandidateId).toBe("public-certification-1");
  });

  test("mismatched job/wordpress draft approval is rejected", () => {
    const approval = draftApproval({ wordpressObjectId: "20241" });

    expect(referenceApprovalMatchesTargetIdentity({
      approval,
      stateCode: "TX",
      citySlug: null,
      target: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
    })).toBe(false);

    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: approval,
      publicCertifiedReference: null,
    });
    expect(authority.approvedReferenceCount).toBe(0);
  });

  test("city_service governed-local approvals are not reinterpreted as state draft approvals", () => {
    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: {
        approvalKind: "GOVERNED_LOCAL_REFERENCE",
        campaignId,
        stateCode: "TX",
        citySlug: "austin",
        referenceDraftId: "ref-1",
        referenceRevision: 1,
        imageCandidateId: "candidate-1",
        imageCandidateRevision: 1,
        imageSha256: "b".repeat(64),
        provenanceSha256: "c".repeat(64),
        receiptSha256: "d".repeat(64),
        approvedAt: "2026-09-20T00:00:00.000Z",
        approvedBy: "operator",
      },
      publicCertifiedReference: null,
    });

    expect(authority.approvedReferenceCount).toBe(0);
    expect(authority.source).toBeNull();
  });

  test("draft approval remains draft authority and does not get counted as public certification", () => {
    const authority = resolveStateServiceActivationReferenceAuthority({
      campaignId,
      stateCode: "TX",
      selectedTarget: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb", wordpressObjectId: "20240" },
      draftApproval: draftApproval(),
      publicCertifiedReference: certifiedReference({ certificationId: "public-certification-2" }),
    });

    expect(authority.approvedReferenceCount).toBe(1);
    expect(authority.source).toBe("WORDPRESS_DRAFT");
    expect(authority.referenceApproval?.imageCandidateId).toBe("wordpress-draft:20240");
  });
});
