import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, toNamespacedPath } from "node:path";
import {
  deepClone,
  loadPersistedState,
  resolvePersistenceRoot,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

export type GlwReferenceImageRequirementPurpose = "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL";
export type GlwReferenceImageCandidateStatus = "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED";
export type GlwReferenceImageCandidate = {
  candidateId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceDraftId: string;
  requirementPurpose: GlwReferenceImageRequirementPurpose;
  revision: number;
  sourceType: "GENERATED_VISUAL" | "OWNER_ASSET";
  status: GlwReferenceImageCandidateStatus;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  sha256: string;
  storageKey: string;
  generationPrompt: string | null;
  visualBrief: string;
  sourceAssetReference: string | null;
  generationBasis: {
    provider: "LOCAL_GOVERNED_COMPOSITOR" | "OWNER_UPLOAD";
    imageProfileReference: string;
    knowledgePackRevision: number;
    authorityReferences: readonly string[];
    referenceOnlyInputsUsed: false;
    competitorInputsUsed: false;
  };
  altText: string;
  ownerInstructions: string | null;
  priorCandidateId: string | null;
  createdAt: string;
  createdBy: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

type State = { candidates: GlwReferenceImageCandidate[] };
const NAMESPACE = "glw-campaign-reference-image-candidate-v1";
const seed = (): State => ({ candidates: [] });
function load() { return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }); }
function safe(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image"; }
function extension(mimeType: GlwReferenceImageCandidate["mimeType"]): string { return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; }
function signatureValid(bytes: Buffer, mimeType: GlwReferenceImageCandidate["mimeType"]): boolean {
  return mimeType === "image/jpeg"
    ? bytes.subarray(0, 3).toString("hex") === "ffd8ff"
    : mimeType === "image/png"
      ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
      : bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export function listGlwReferenceImageCandidates(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceDraftId: string;
}): readonly GlwReferenceImageCandidate[] {
  return deepClone(load().state.candidates.filter((candidate) =>
    candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId
    && candidate.campaignId === input.campaignId
    && candidate.referenceDraftId === input.referenceDraftId));
}

export function getLatestGlwReferenceImageCandidate(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceDraftId: string;
}): GlwReferenceImageCandidate | null {
  return [...listGlwReferenceImageCandidates(input)].sort((left, right) => left.revision - right.revision).at(-1) ?? null;
}

export function saveGlwReferenceImageCandidate(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  referenceDraftId: string;
  requirementPurpose: GlwReferenceImageRequirementPurpose;
  sourceType: GlwReferenceImageCandidate["sourceType"];
  mimeType: GlwReferenceImageCandidate["mimeType"];
  bytes: Buffer;
  generationPrompt?: string | null;
  visualBrief: string;
  sourceAssetReference?: string | null;
  imageProfileReference: string;
  knowledgePackRevision: number;
  authorityReferences: readonly string[];
  altText: string;
  ownerInstructions?: string | null;
  actor: string;
}): GlwReferenceImageCandidate {
  if (!input.bytes.length || input.bytes.length > 20_000_000 || !signatureValid(input.bytes, input.mimeType)) {
    throw new Error("REFERENCE_IMAGE_CANDIDATE_BINARY_INVALID");
  }
  if (!input.visualBrief.trim() || !input.altText.trim() || input.knowledgePackRevision < 1) {
    throw new Error("REFERENCE_IMAGE_CANDIDATE_AUTHORITY_INVALID");
  }
  const loaded = load();
  const scoped = loaded.state.candidates.filter((candidate) =>
    candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId
    && candidate.campaignId === input.campaignId
    && candidate.referenceDraftId === input.referenceDraftId);
  const previous = scoped.sort((left, right) => left.revision - right.revision).at(-1);
  const candidateId = `reference-image-${randomUUID()}`;
  const storageKey = [safe(input.siteId), safe(input.campaignId), `${safe(candidateId)}.${extension(input.mimeType)}`].join("/");
  const fullPath = join(resolvePersistenceRoot(), "glw-campaign-reference-images", storageKey);
  const storagePath = toNamespacedPath(fullPath);
  mkdirSync(dirname(storagePath), { recursive: true });
  writeFileSync(storagePath, input.bytes);
  const candidate: GlwReferenceImageCandidate = {
    candidateId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    campaignId: input.campaignId,
    referenceDraftId: input.referenceDraftId,
    requirementPurpose: input.requirementPurpose,
    revision: (previous?.revision ?? 0) + 1,
    sourceType: input.sourceType,
    status: "READY_FOR_OWNER_REVIEW",
    mimeType: input.mimeType,
    byteSize: input.bytes.length,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    storageKey,
    generationPrompt: input.generationPrompt?.trim() || null,
    visualBrief: input.visualBrief.trim(),
    sourceAssetReference: input.sourceAssetReference?.trim() || null,
    generationBasis: {
      provider: input.sourceType === "GENERATED_VISUAL" ? "LOCAL_GOVERNED_COMPOSITOR" : "OWNER_UPLOAD",
      imageProfileReference: input.imageProfileReference,
      knowledgePackRevision: input.knowledgePackRevision,
      authorityReferences: [...new Set(input.authorityReferences)].sort(),
      referenceOnlyInputsUsed: false,
      competitorInputsUsed: false,
    },
    altText: input.altText.trim(),
    ownerInstructions: input.ownerInstructions?.trim() || null,
    priorCandidateId: previous?.candidateId ?? null,
    createdAt: new Date().toISOString(),
    createdBy: input.actor,
    decidedAt: null,
    decidedBy: null,
  };
  loaded.state.candidates.push(candidate);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(candidate);
}

export function decideGlwReferenceImageCandidate(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  candidateId: string;
  decision: "APPROVE" | "REJECT";
  actor: string;
}): GlwReferenceImageCandidate {
  const loaded = load();
  const index = loaded.state.candidates.findIndex((candidate) =>
    candidate.candidateId === input.candidateId
    && candidate.organizationId === input.organizationId
    && candidate.siteId === input.siteId
    && candidate.campaignId === input.campaignId);
  if (index < 0 || loaded.state.candidates[index].status !== "READY_FOR_OWNER_REVIEW") {
    throw new Error("REFERENCE_IMAGE_CANDIDATE_NOT_REVIEWABLE");
  }
  loaded.state.candidates[index] = {
    ...loaded.state.candidates[index],
    status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
    decidedAt: new Date().toISOString(),
    decidedBy: input.actor,
  };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(loaded.state.candidates[index]);
}

export function readGlwReferenceImageCandidateBytes(input: {
  organizationId: string;
  siteId: string;
  campaignId: string;
  candidateId: string;
}): { candidate: GlwReferenceImageCandidate; bytes: Buffer } | null {
  const candidate = load().state.candidates.find((item) =>
    item.candidateId === input.candidateId
    && item.organizationId === input.organizationId
    && item.siteId === input.siteId
    && item.campaignId === input.campaignId);
  if (!candidate) return null;
  const bytes = readFileSync(toNamespacedPath(join(resolvePersistenceRoot(), "glw-campaign-reference-images", candidate.storageKey)));
  if (createHash("sha256").update(bytes).digest("hex") !== candidate.sha256) {
    throw new Error("REFERENCE_IMAGE_CANDIDATE_STORAGE_MISMATCH");
  }
  return { candidate: deepClone(candidate), bytes };
}
