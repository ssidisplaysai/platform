import "server-only";

import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";

const NAMESPACE = "glw-campaign-local-reference-repository-v1";

export type GlwLocalReferenceStatus = "READY_FOR_OWNER_REVIEW" | "CHANGES_REQUESTED" | "OWNER_APPROVED_LOCAL";

export type GlwLocalReferenceDraft = {
  referenceDraftId: string;
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug: string;
  cityName: string;
  canonicalPath: string;
  revision: number;
  status: GlwLocalReferenceStatus;
  title: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  excerpt: string;
  sections: readonly { heading: string; bodyHtml: string }[];
  internalLinks: readonly { label: string; url: string }[];
  image: {
    required: boolean;
    requirementPurpose?: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL";
    candidateId?: string | null;
    candidateRevision?: number | null;
    status: "OWNER_ASSET_CANDIDATE" | "GENERATED_VISUAL_CANDIDATE" | "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED" | "MISSING";
    assetReference: string | null;
    classification: "OWNER_ASSET" | "GENERATED_VISUAL" | null;
    altText: string | null;
    ownerApproved: boolean;
  };
  provenance: {
    parentCampaignId: string;
    knowledgePackRevision: number;
    authorityReferences: readonly string[];
  };
  reviewInstructions: string | null;
  createdAt: string;
  updatedAt: string;
};

type State = { drafts: GlwLocalReferenceDraft[] };
let revision = 0;
const store = new Map<string, GlwLocalReferenceDraft>();

function seed(): State { return { drafts: [] }; }
function load(): void {
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  store.clear();
  loaded.state.drafts.forEach((draft) => store.set(draft.referenceDraftId, deepClone(draft)));
  revision = loaded.revision;
}
function persist(): void {
  const saved = savePersistedState({
    namespace: NAMESPACE,
    state: { drafts: [...store.values()].map((draft) => deepClone(draft)) },
    expectedRevision: revision,
  });
  revision = saved.revision;
}
function id(campaignId: string, stateCode: string, citySlug: string): string {
  return `local-reference-${campaignId}-${stateCode.trim().toLowerCase()}-${citySlug.trim().toLowerCase()}`;
}

export function getGlwLocalReferenceDraft(campaignId: string, stateCode: string, citySlug: string): GlwLocalReferenceDraft | null {
  load();
  const draft = store.get(id(campaignId, stateCode, citySlug));
  return draft ? deepClone(draft) : null;
}

export function saveGlwLocalReferenceDraft(input: Omit<GlwLocalReferenceDraft, "referenceDraftId" | "revision" | "status" | "reviewInstructions" | "createdAt" | "updatedAt">): GlwLocalReferenceDraft {
  load();
  const referenceDraftId = id(input.campaignId, input.stateCode, input.citySlug);
  const existing = store.get(referenceDraftId);
  const timestamp = new Date().toISOString();
  const draft: GlwLocalReferenceDraft = {
    ...input,
    referenceDraftId,
    revision: (existing?.revision ?? 0) + 1,
    status: "READY_FOR_OWNER_REVIEW",
    reviewInstructions: null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  store.set(referenceDraftId, draft);
  persist();
  return deepClone(draft);
}

export function requestGlwLocalReferenceChanges(input: {
  campaignId: string;
  stateCode: string;
  citySlug: string;
  instructions: string;
}): GlwLocalReferenceDraft {
  load();
  const referenceDraftId = id(input.campaignId, input.stateCode, input.citySlug);
  const existing = store.get(referenceDraftId);
  if (!existing) throw new Error("Local campaign reference was not found.");
  const draft: GlwLocalReferenceDraft = {
    ...existing,
    status: "CHANGES_REQUESTED",
    reviewInstructions: input.instructions.trim(),
    updatedAt: new Date().toISOString(),
  };
  store.set(referenceDraftId, draft);
  persist();
  return deepClone(draft);
}

export function approveGlwLocalReferenceForMaterialization(input: {
  campaignId: string;
  stateCode: string;
  citySlug: string;
}): GlwLocalReferenceDraft {
  load();
  const referenceDraftId = id(input.campaignId, input.stateCode, input.citySlug);
  const existing = store.get(referenceDraftId);
  if (!existing || existing.status !== "READY_FOR_OWNER_REVIEW") {
    throw new Error("Only a review-ready local reference can be approved.");
  }
  if (existing.image.required && (!existing.image.candidateId || existing.image.status !== "APPROVED" || !existing.image.ownerApproved)) {
    throw new Error("Required reference image must be owner-approved before reference approval.");
  }
  const draft = { ...existing, status: "OWNER_APPROVED_LOCAL" as const, updatedAt: new Date().toISOString() };
  store.set(referenceDraftId, draft);
  persist();
  return deepClone(draft);
}

export function updateGlwLocalReferenceImage(input: {
  campaignId: string;
  stateCode: string;
  citySlug: string;
  candidateId: string;
  candidateRevision: number;
  status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED";
  sourceType: "GENERATED_VISUAL" | "OWNER_ASSET";
  assetReference: string;
  altText: string;
}): GlwLocalReferenceDraft {
  load();
  const referenceDraftId = id(input.campaignId, input.stateCode, input.citySlug);
  const existing = store.get(referenceDraftId);
  if (!existing) throw new Error("Local campaign reference was not found.");
  const updated: GlwLocalReferenceDraft = {
    ...existing,
    image: {
      ...existing.image,
      required: true,
      requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL",
      candidateId: input.candidateId,
      candidateRevision: input.candidateRevision,
      status: input.status,
      assetReference: input.assetReference,
      classification: input.sourceType,
      altText: input.altText,
      ownerApproved: input.status === "APPROVED",
    },
    updatedAt: new Date().toISOString(),
  };
  store.set(referenceDraftId, updated);
  persist();
  return deepClone(updated);
}
