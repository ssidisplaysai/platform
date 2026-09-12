import "server-only";

import { createHash } from "node:crypto";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const PERSISTENCE_NAMESPACE = "glw-campaign-reference-approval-repository";

export type GlwCampaignReferenceApproval = {
  approvalKind?: "WORDPRESS_DRAFT";
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
  approvedAt: string;
} | {
  approvalKind: "GOVERNED_LOCAL_REFERENCE";
  campaignId: string;
  stateCode: string;
  citySlug: string;
  referenceDraftId: string;
  referenceRevision: number;
  imageCandidateId: string;
  imageCandidateRevision: number;
  imageSha256: string;
  provenanceSha256: string;
  receiptSha256: string;
  approvedAt: string;
  approvedBy: string;
};

type RepositoryState = {
  approvals: GlwCampaignReferenceApproval[];
};

let stateRevision = 0;
const approvalStore = new Map<string, GlwCampaignReferenceApproval>();

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function key(
  campaignId: string,
  stateCode: string,
  citySlug?: string | null,
  approvalKind: "WORDPRESS_DRAFT" | "GOVERNED_LOCAL_REFERENCE" = "WORDPRESS_DRAFT",
): string {
  const base = `${campaignId}::${stateCode.trim().toUpperCase()}`;
  const city = normalizeCitySlug(citySlug);
  return `${city ? `${base}::${city}` : base}::${approvalKind}`;
}

function applyState(state: RepositoryState): void {
  approvalStore.clear();

  for (const approval of state.approvals) {
    approvalStore.set(
      key(approval.campaignId, approval.stateCode, approval.citySlug, approval.approvalKind ?? "WORDPRESS_DRAFT"),
      deepClone(approval),
    );
  }
}

function snapshotState(): RepositoryState {
  return {
    approvals: Array.from(
      approvalStore.values(),
      (approval) => deepClone(approval),
    ),
  };
}

function loadState(): void {
  const loaded = loadPersistedState<RepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ approvals: [] }),
  });
  applyState(loaded.state);
  stateRevision = loaded.revision;
}

loadState();

function persistState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

export function getGlwCampaignReferenceApproval(
  campaignId: string,
  stateCode: string,
  citySlug?: string | null,
): GlwCampaignReferenceApproval | null {
  loadState();
  const approval = approvalStore.get(key(campaignId, stateCode, citySlug, "WORDPRESS_DRAFT"))
    ?? approvalStore.get(key(campaignId, stateCode, citySlug, "GOVERNED_LOCAL_REFERENCE"));
  return approval ? deepClone(approval) : null;
}

export function getGovernedLocalCampaignReferenceApproval(
  campaignId: string,
  stateCode: string,
  citySlug: string,
): Extract<GlwCampaignReferenceApproval, { approvalKind: "GOVERNED_LOCAL_REFERENCE" }> | null {
  loadState();
  const approval = approvalStore.get(key(campaignId, stateCode, citySlug, "GOVERNED_LOCAL_REFERENCE"));
  return approval?.approvalKind === "GOVERNED_LOCAL_REFERENCE" ? deepClone(approval) : null;
}

export function listGlwCampaignReferenceApprovals(campaignId: string): readonly GlwCampaignReferenceApproval[] {
  loadState();
  return Array.from(approvalStore.values())
    .filter((approval) => approval.campaignId === campaignId)
    .map((approval) => deepClone(approval));
}

export function approveGlwCampaignReference(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignReferenceApproval {
  loadState();
  const approval: GlwCampaignReferenceApproval = {
    approvalKind: "WORDPRESS_DRAFT",
    campaignId: input.campaignId,
    stateCode: input.stateCode.trim().toUpperCase(),
    citySlug: normalizeCitySlug(input.citySlug),
    jobId: input.jobId,
    wordpressObjectId: input.wordpressObjectId,
    approvedAt: new Date().toISOString(),
  };
  const approvalKey = key(approval.campaignId, approval.stateCode, approval.citySlug, "WORDPRESS_DRAFT");
  const existing = approvalStore.get(approvalKey);
  if (existing) {
    if (existing.approvalKind !== "GOVERNED_LOCAL_REFERENCE" && existing.jobId === input.jobId && existing.wordpressObjectId === input.wordpressObjectId) {
      return deepClone(existing);
    }
    throw new Error("WORDPRESS_REFERENCE_APPROVAL_ALREADY_RECORDED");
  }
  approvalStore.set(approvalKey, approval);

  persistState();

  return deepClone(approval);
}

export function approveGovernedLocalCampaignReference(input: {
  campaignId: string;
  stateCode: string;
  citySlug: string;
  referenceDraftId: string;
  referenceRevision: number;
  imageCandidateId: string;
  imageCandidateRevision: number;
  imageSha256: string;
  provenance: unknown;
  approvedBy: string;
}): Extract<GlwCampaignReferenceApproval, { approvalKind: "GOVERNED_LOCAL_REFERENCE" }> {
  loadState();
  const stateCode = input.stateCode.trim().toUpperCase();
  const citySlug = normalizeCitySlug(input.citySlug);
  if (!citySlug || input.referenceRevision < 1 || input.imageCandidateRevision < 1 || !/^[0-9a-f]{64}$/i.test(input.imageSha256)) {
    throw new Error("GOVERNED_REFERENCE_APPROVAL_IDENTITY_INVALID");
  }
  const provenanceSha256 = createHash("sha256").update(JSON.stringify(input.provenance)).digest("hex");
  const receiptIdentity = {
    approvalKind: "GOVERNED_LOCAL_REFERENCE" as const,
    campaignId: input.campaignId,
    stateCode,
    citySlug,
    referenceDraftId: input.referenceDraftId,
    referenceRevision: input.referenceRevision,
    imageCandidateId: input.imageCandidateId,
    imageCandidateRevision: input.imageCandidateRevision,
    imageSha256: input.imageSha256.toLowerCase(),
    provenanceSha256,
  };
  const receiptSha256 = createHash("sha256").update(JSON.stringify(receiptIdentity)).digest("hex");
  const approvalKey = key(input.campaignId, stateCode, citySlug, "GOVERNED_LOCAL_REFERENCE");
  const existing = approvalStore.get(approvalKey);
  if (existing) {
    if (existing.approvalKind === "GOVERNED_LOCAL_REFERENCE" && existing.receiptSha256 === receiptSha256) {
      return deepClone(existing);
    }
    throw new Error("GOVERNED_REFERENCE_APPROVAL_ALREADY_RECORDED");
  }
  const approval: Extract<GlwCampaignReferenceApproval, { approvalKind: "GOVERNED_LOCAL_REFERENCE" }> = {
    ...receiptIdentity,
    receiptSha256,
    approvedAt: new Date().toISOString(),
    approvedBy: input.approvedBy,
  };
  approvalStore.set(approvalKey, approval);
  persistState();
  return deepClone(approval);
}
