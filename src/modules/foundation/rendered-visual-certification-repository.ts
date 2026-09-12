import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deepClone, loadPersistedState, resolvePersistenceRoot, savePersistedState } from "./foundation-persistence";
import {
  hashRenderedVisualContent,
  renderedVisualDecisionCurrency,
  sameRenderedVisualPageIdentity,
  validateRenderedVisualCertification,
  type RenderedVisualCertification,
  type RenderedVisualOwnerDecision,
  type RenderedVisualOwnerDecisionState,
  type RenderedVisualPageIdentity,
  type RenderedVisualScreenshotArtifact,
} from "./rendered-visual-certification";

const NAMESPACE = "rendered-visual-certification-v1";
type State = { certifications: RenderedVisualCertification[]; decisions: RenderedVisualOwnerDecision[] };
const seed = (): State => ({ certifications: [], decisions: [] });
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });

function bounded(value: string | null | undefined, maximum: number, code: string): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > maximum || /(password|authorization|bearer|cookie|secret|token|api[_-]?key)\s*[:=]/i.test(normalized)) throw new Error(code);
  return normalized;
}

export function listRenderedVisualCertifications(input: { organizationId: string; siteId: string; pageId?: string }): RenderedVisualCertification[] {
  return deepClone(load().state.certifications.filter((item) => item.identity.organizationId === input.organizationId && item.identity.siteId === input.siteId && (!input.pageId || item.identity.pageId === input.pageId)));
}

export function getRenderedVisualCertificationState(input: { currentIdentity: RenderedVisualPageIdentity }): {
  certification: RenderedVisualCertification | null;
  decision: RenderedVisualOwnerDecision | null;
  certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE";
  decisionState: "PENDING" | "CURRENT" | "STALE";
} {
  const state = load().state;
  const certification = state.certifications.filter((item) => item.identity.organizationId === input.currentIdentity.organizationId && item.identity.siteId === input.currentIdentity.siteId && item.identity.pageId === input.currentIdentity.pageId).at(-1) ?? null;
  if (!certification) return { certification: null, decision: null, certificationState: "NOT_CERTIFIED", decisionState: "PENDING" };
  const decision = state.decisions.filter((item) => item.certificationId === certification.certificationId).at(-1) ?? null;
  const identityCurrent = sameRenderedVisualPageIdentity(certification.identity, input.currentIdentity);
  return { certification: deepClone(certification), decision: deepClone(decision), certificationState: identityCurrent ? "CURRENT" : "STALE", decisionState: renderedVisualDecisionCurrency({ certification, decision, currentIdentity: input.currentIdentity }) };
}

export function saveRenderedVisualCertification(input: RenderedVisualCertification): RenderedVisualCertification {
  const certification = validateRenderedVisualCertification(input);
  const loaded = load();
  if (loaded.state.certifications.some((item) => item.certificationId === certification.certificationId || item.captureSetId === certification.captureSetId)) throw new Error("VISUAL_CERTIFICATION_IDENTITY_ALREADY_EXISTS");
  loaded.state.certifications.push(certification);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(certification);
}

export function decideRenderedVisualCertification(input: { certificationId: string; decision: RenderedVisualOwnerDecisionState; actor: string; note?: string | null; currentIdentity: RenderedVisualPageIdentity; now?: string }): RenderedVisualOwnerDecision {
  const loaded = load();
  const certification = loaded.state.certifications.find((item) => item.certificationId === input.certificationId);
  if (!certification) throw new Error("VISUAL_CERTIFICATION_NOT_FOUND");
  if (!sameRenderedVisualPageIdentity(certification.identity, input.currentIdentity)) throw new Error("VISUAL_CERTIFICATION_STALE");
  const actor = bounded(input.actor, 200, "VISUAL_DECISION_ACTOR_INVALID"); if (!actor) throw new Error("VISUAL_DECISION_ACTOR_REQUIRED");
  const decision: RenderedVisualOwnerDecision = { decisionId: `visual-decision-${randomUUID()}`, certificationId: certification.certificationId, captureSetId: certification.captureSetId, pageRevisionIdentity: certification.identity.pageRevisionIdentity, contentHash: certification.identity.contentHash, renderedContentHash: certification.identity.renderedContentHash, decision: input.decision, note: bounded(input.note, 1000, "VISUAL_DECISION_NOTE_INVALID"), decidedAt: input.now ?? new Date().toISOString(), decidedBy: actor, publicationAuthorized: false };
  if (!Number.isFinite(Date.parse(decision.decidedAt))) throw new Error("VISUAL_DECISION_TIME_INVALID");
  loaded.state.decisions.push(decision);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(decision);
}

export function listRenderedVisualOwnerDecisions(certificationId: string): RenderedVisualOwnerDecision[] {
  return deepClone(load().state.decisions.filter((item) => item.certificationId === certificationId));
}

function segment(value: string): string { const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""); if (!safe) throw new Error("VISUAL_ARTIFACT_IDENTITY_INVALID"); return safe; }
function extension(mediaType: RenderedVisualScreenshotArtifact["mediaType"]): string { return mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png"; }
function imageSignatureValid(bytes: Uint8Array, mediaType: RenderedVisualScreenshotArtifact["mediaType"]): boolean { return mediaType === "image/png" ? Buffer.from(bytes.subarray(0, 8)).toString("hex") === "89504e470d0a1a0a" : mediaType === "image/jpeg" ? Buffer.from(bytes.subarray(0, 3)).toString("hex") === "ffd8ff" : Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"; }

export function storeRenderedVisualCaptureArtifact(input: { organizationId: string; siteId: string; captureSetId: string; captureId: string; mediaType: RenderedVisualScreenshotArtifact["mediaType"]; bytes: Uint8Array; width: number; height: number }): RenderedVisualScreenshotArtifact {
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > 20_000_000 || !imageSignatureValid(input.bytes, input.mediaType)) throw new Error("VISUAL_CAPTURE_ARTIFACT_INVALID");
  if (!Number.isSafeInteger(input.width) || input.width < 1 || !Number.isSafeInteger(input.height) || input.height < 1) throw new Error("VISUAL_ARTIFACT_DIMENSIONS_INVALID");
  const reference = ["rendered-visual-artifacts", segment(input.organizationId), segment(input.siteId), segment(input.captureSetId), `${segment(input.captureId)}.${extension(input.mediaType)}`].join("/");
  const path = join(resolvePersistenceRoot(), ...reference.split("/"));
  const sha256 = hashRenderedVisualContent(input.bytes);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) { if (hashRenderedVisualContent(readFileSync(path)) !== sha256) throw new Error("VISUAL_CAPTURE_ARTIFACT_COLLISION"); }
  else writeFileSync(path, input.bytes);
  return { reference, sha256, byteSize: input.bytes.byteLength, width: input.width, height: input.height, mediaType: input.mediaType };
}

export function readRenderedVisualCaptureArtifact(artifact: RenderedVisualScreenshotArtifact): Uint8Array {
  const root = resolvePersistenceRoot();
  const normalized = artifact.reference.replaceAll("\\", "/");
  if (!normalized.startsWith("rendered-visual-artifacts/") || normalized.includes("..")) throw new Error("VISUAL_ARTIFACT_REFERENCE_INVALID");
  const bytes = readFileSync(join(root, ...normalized.split("/")));
  if (bytes.byteLength !== artifact.byteSize || hashRenderedVisualContent(bytes) !== artifact.sha256) throw new Error("VISUAL_CAPTURE_ARTIFACT_HASH_MISMATCH");
  return bytes;
}