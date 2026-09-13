import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deepClone, loadPersistedState, resolvePersistenceRoot, savePersistedState } from "./foundation-persistence";
import { hashRenderedVisualContent, type RenderedVisualScreenshotArtifact } from "./rendered-visual-certification";
import { LOCAL_THEME_VISUAL_CERTIFICATION_CONTRACT, type LocalThemeVisualCertification } from "./local-theme-visual-certification";

const NAMESPACE = "local-theme-visual-certification-v1";
type State = { certifications: LocalThemeVisualCertification[] };
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ certifications: [] }) });
const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

export function storeLocalThemeVisualArtifact(input: { bundleId: string; captureId: string; bytes: Uint8Array; width: number; height: number }): RenderedVisualScreenshotArtifact {
  if (!input.bytes.length || Buffer.from(input.bytes.subarray(0, 8)).toString("hex") !== "89504e470d0a1a0a") throw new Error("LOCAL_THEME_CAPTURE_INVALID");
  const reference = `local-theme-visual-artifacts/${safe(input.bundleId)}/${safe(input.captureId)}.png`; const path = join(resolvePersistenceRoot(), ...reference.split("/")); const sha256 = hashRenderedVisualContent(input.bytes); mkdirSync(dirname(path), { recursive: true }); if (existsSync(path) && hashRenderedVisualContent(readFileSync(path)) !== sha256) throw new Error("LOCAL_THEME_CAPTURE_COLLISION"); if (!existsSync(path)) writeFileSync(path, input.bytes); return { reference, sha256, byteSize: input.bytes.length, width: input.width, height: input.height, mediaType: "image/png" };
}

export function saveLocalThemeVisualCertification(certification: LocalThemeVisualCertification): LocalThemeVisualCertification {
  if (certification.contract !== LOCAL_THEME_VISUAL_CERTIFICATION_CONTRACT || certification.captures.length !== 4 || certification.ownerReviewRequired !== true || certification.countsAsWordPressRenderCertification !== false || certification.wordpressMutationPerformed || certification.campaignMutationPerformed || certification.publicationPerformed || certification.dispatchPerformed) throw new Error("LOCAL_THEME_VISUAL_CERTIFICATION_INVALID");
  const loaded = load(); const existing = loaded.state.certifications.find((item) => item.certificationId === certification.certificationId); if (existing) return deepClone(existing); loaded.state.certifications.push(deepClone(certification)); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(certification);
}

export function getLocalThemeVisualCertification(bundleId: string, rendererVersion?: string): LocalThemeVisualCertification | null { const item = load().state.certifications.filter((candidate) => candidate.bundleId === bundleId && (!rendererVersion || candidate.rendererVersion === rendererVersion)).at(-1); return item ? deepClone(item) : null; }