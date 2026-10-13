import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deepClone, loadPersistedState, resolvePersistenceRoot, savePersistedState } from "./foundation-persistence";

export type SitePageImageCandidateStatus = "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED" | "BLOCKED";
export type SitePageImageCandidate = {
  candidateId: string; organizationId: string; siteId: string; buildSessionId: string; pageId: string; pageRevisionId: string; slotId: string; revision: number;
  sourceType: "GENERATED_VISUAL" | "OWNER_ASSET"; status: SitePageImageCandidateStatus; mimeType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number; sha256: string; storageKey: string;
  generationPrompt: string | null; visualBrief: string; generationBasis: { creativeRevision: number; authorityReferences: string[]; provider: "OPENAI_IMAGE" | "OWNER_UPLOAD"; referenceOnlyInputsUsed: false; competitorInputsUsed: false };
  ownerInstructions: string | null; priorCandidateId: string | null; createdAt: string; createdBy: string; decidedAt: string | null; decidedBy: string | null;
};

type State = { candidates: SitePageImageCandidate[] };
const NAMESPACE = "site-page-image-candidate-repository";
const seed = (): State => ({ candidates: [] });
function load() { return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }); }
function safe(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image"; }
function extension(mimeType: SitePageImageCandidate["mimeType"]): string { return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; }
function signatureValid(bytes: Buffer, mimeType: SitePageImageCandidate["mimeType"]): boolean { return mimeType === "image/jpeg" ? bytes.subarray(0, 3).toString("hex") === "ffd8ff" : mimeType === "image/png" ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" : bytes.subarray(8, 12).toString("ascii") === "WEBP"; }

export function listSitePageImageCandidates(input: { organizationId: string; siteId: string; buildSessionId: string }): SitePageImageCandidate[] {
  return deepClone(load().state.candidates.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId));
}

export function getLatestSitePageImageCandidate(input: { organizationId: string; siteId: string; buildSessionId: string; pageId: string; slotId: string }): SitePageImageCandidate | null {
  return listSitePageImageCandidates(input).filter((item) => item.pageId === input.pageId && item.slotId === input.slotId).sort((left, right) => left.revision - right.revision).at(-1) ?? null;
}

export function saveSitePageImageCandidate(input: {
  organizationId: string; siteId: string; buildSessionId: string; pageId: string; pageRevisionId: string; slotId: string; sourceType: SitePageImageCandidate["sourceType"];
  mimeType: SitePageImageCandidate["mimeType"]; bytes: Buffer; generationPrompt?: string | null; visualBrief: string; creativeRevision: number; authorityReferences: string[]; ownerInstructions?: string | null; actor: string;
}): SitePageImageCandidate {
  if (!input.bytes.length || input.bytes.length > 20_000_000 || !signatureValid(input.bytes, input.mimeType)) throw new Error("IMAGE_CANDIDATE_BINARY_INVALID");
  const loaded = load(); const previous = loaded.state.candidates.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.pageId === input.pageId && item.slotId === input.slotId).sort((left, right) => left.revision - right.revision).at(-1);
  const candidateId = `site-image-${randomUUID()}`; const storageKey = [safe(input.siteId), safe(input.buildSessionId), `${safe(candidateId)}.${extension(input.mimeType)}`].join("/"); const fullPath = join(/* turbopackIgnore: true */ resolvePersistenceRoot(), "site-page-image-candidates", storageKey);
  mkdirSync(dirname(fullPath), { recursive: true }); writeFileSync(fullPath, input.bytes);
  const candidate: SitePageImageCandidate = { candidateId, organizationId: input.organizationId, siteId: input.siteId, buildSessionId: input.buildSessionId, pageId: input.pageId, pageRevisionId: input.pageRevisionId, slotId: input.slotId, revision: (previous?.revision ?? 0) + 1, sourceType: input.sourceType, status: "READY_FOR_OWNER_REVIEW", mimeType: input.mimeType, byteSize: input.bytes.length, sha256: createHash("sha256").update(input.bytes).digest("hex"), storageKey, generationPrompt: input.generationPrompt?.trim() || null, visualBrief: input.visualBrief.trim(), generationBasis: { creativeRevision: input.creativeRevision, authorityReferences: [...new Set(input.authorityReferences)].sort(), provider: input.sourceType === "OWNER_ASSET" ? "OWNER_UPLOAD" : "OPENAI_IMAGE", referenceOnlyInputsUsed: false, competitorInputsUsed: false }, ownerInstructions: input.ownerInstructions?.trim() || null, priorCandidateId: previous?.candidateId ?? null, createdAt: new Date().toISOString(), createdBy: input.actor, decidedAt: null, decidedBy: null };
  loaded.state.candidates.push(candidate); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(candidate);
}

export function decideSitePageImageCandidate(input: { organizationId: string; siteId: string; buildSessionId: string; candidateId: string; decision: "APPROVE" | "REJECT"; actor: string }): SitePageImageCandidate {
  const loaded = load(); const index = loaded.state.candidates.findIndex((item) => item.candidateId === input.candidateId && item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  if (index < 0 || loaded.state.candidates[index].status !== "READY_FOR_OWNER_REVIEW") throw new Error("IMAGE_CANDIDATE_NOT_REVIEWABLE");
  loaded.state.candidates[index] = { ...loaded.state.candidates[index], status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedAt: new Date().toISOString(), decidedBy: input.actor }; savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(loaded.state.candidates[index]);
}

export function readSitePageImageCandidateBytes(input: { organizationId: string; siteId: string; candidateId: string }): { candidate: SitePageImageCandidate; bytes: Buffer } | null {
  const candidate = load().state.candidates.find((item) => item.candidateId === input.candidateId && item.organizationId === input.organizationId && item.siteId === input.siteId); if (!candidate) return null;
  const bytes = readFileSync(join(/* turbopackIgnore: true */ resolvePersistenceRoot(), "site-page-image-candidates", candidate.storageKey)); if (createHash("sha256").update(bytes).digest("hex") !== candidate.sha256) throw new Error("IMAGE_CANDIDATE_STORAGE_MISMATCH"); return { candidate: deepClone(candidate), bytes };
}