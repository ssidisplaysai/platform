import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { deepClone, loadPersistedState, resetPersistedState, savePersistedState } from "./foundation-persistence";

export const OWNER_SUPPLIED_MEDIA_INGESTION = "OWNER_SUPPLIED_MEDIA_INGESTION" as const;
export const OWNER_MEDIA_MAX_BYTES = 5_000_000;
export type OwnerMediaSourceClass = "OWNER_SUPPLIED" | "SSI_FIRST_PARTY" | "VERIFIED_FACTORY_ASSET" | "VERIFIED_INTERNAL_ASSET";

export type OwnerMediaAuthority = {
  authorityId: string;
  siteId: "site-ssi-projectorenclosure";
  hostname: "projectorenclosure.com";
  sourceClass: OwnerMediaSourceClass;
  provenance: "OWNER_SUPPLIED_SSI_FIRST_PARTY";
  localPath: string;
  sha256: string;
  mimeType: "image/png";
  byteSize: number;
  filename: string;
  productId: "prod-ssi-integrator-series-projector-enclosure";
  productFamily: "family-ssi-integrator-series";
  visualClassification: "VERIFIED_PRODUCT_DETAIL_IMAGE";
  title: string;
  altText: string;
  allowedPurpose: string;
  uploadAuthorizationState: "APPROVED";
  sourceAuthorityReference: string;
};

const basePath = "resources/product-authority/projectorenclosure/integrator/extracted-visuals";
export const OWNER_MEDIA_AUTHORITY_REGISTRY: readonly OwnerMediaAuthority[] = [
  { authorityId: "integrator-unistrut-owner-pdf-p3", siteId: "site-ssi-projectorenclosure", hostname: "projectorenclosure.com", sourceClass: "OWNER_SUPPLIED", provenance: "OWNER_SUPPLIED_SSI_FIRST_PARTY", localPath: `${basePath}/integrator-unistrut-mounting-owner-pdf-page-3.png`, sha256: "6fd6a066fabdda02e6a84a7a39d69ae3d2dce244d027702e58f6120287579865", mimeType: "image/png", byteSize: 256491, filename: "integrator-unistrut-mounting-owner-pdf-page-3.png", productId: "prod-ssi-integrator-series-projector-enclosure", productFamily: "family-ssi-integrator-series", visualClassification: "VERIFIED_PRODUCT_DETAIL_IMAGE", title: "Integrator Series Unistrut Mounting Detail", altText: "Integrator Series top and bottom Unistrut mounting detail", allowedPurpose: "Integrator mounting feature detail", uploadAuthorizationState: "APPROVED", sourceAuthorityReference: "owner-pdf:2025-integrator-overview-specifications:page:3:image:1" },
  { authorityId: "integrator-sealed-door-owner-pdf-p3", siteId: "site-ssi-projectorenclosure", hostname: "projectorenclosure.com", sourceClass: "OWNER_SUPPLIED", provenance: "OWNER_SUPPLIED_SSI_FIRST_PARTY", localPath: `${basePath}/integrator-sealed-door-interior-owner-pdf-page-3.png`, sha256: "ba3ff2dea08b7b192919199f270a8aa6da3ecaea2a01af36f601d4e1b66e495b", mimeType: "image/png", byteSize: 269288, filename: "integrator-sealed-door-interior-owner-pdf-page-3.png", productId: "prod-ssi-integrator-series-projector-enclosure", productFamily: "family-ssi-integrator-series", visualClassification: "VERIFIED_PRODUCT_DETAIL_IMAGE", title: "Integrator Series Sealed Door Interior", altText: "Integrator Series sealed doorway and insulated interior", allowedPurpose: "Integrator sealed doorway and interior feature detail", uploadAuthorizationState: "APPROVED", sourceAuthorityReference: "owner-pdf:2025-integrator-overview-specifications:page:3:image:2" },
  { authorityId: "integrator-lock-owner-pdf-p3", siteId: "site-ssi-projectorenclosure", hostname: "projectorenclosure.com", sourceClass: "SSI_FIRST_PARTY", provenance: "OWNER_SUPPLIED_SSI_FIRST_PARTY", localPath: `${basePath}/integrator-lock-owner-pdf-page-3.png`, sha256: "d127ba7ee44882fa4621f4e6dbec187493c3f6c28e25fca97713388a83dd6fe5", mimeType: "image/png", byteSize: 227274, filename: "integrator-lock-owner-pdf-page-3.png", productId: "prod-ssi-integrator-series-projector-enclosure", productFamily: "family-ssi-integrator-series", visualClassification: "VERIFIED_PRODUCT_DETAIL_IMAGE", title: "Integrator Series Enclosure Lock Detail", altText: "Integrator Series enclosure lock detail", allowedPurpose: "Integrator lock feature detail", uploadAuthorizationState: "APPROVED", sourceAuthorityReference: "owner-pdf:2025-integrator-overview-specifications:page:3:image:5" },
] as const;

export type OwnerMediaRecord = { id: number; url: string; mimeType: string; title: string; altText: string; status: string; width: number; height: number };
export type OwnerMediaTransport = {
  hostname: string;
  findExact(authority: OwnerMediaAuthority): Promise<OwnerMediaRecord | null>;
  upload(authority: OwnerMediaAuthority, bytes: Buffer): Promise<OwnerMediaRecord>;
  updateMetadata(mediaId: number, authority: OwnerMediaAuthority): Promise<boolean>;
  read(mediaId: number): Promise<OwnerMediaRecord | null>;
  readBytes(url: string): Promise<Buffer | null>;
  findReferences(mediaId: number): Promise<readonly number[]>;
  deleteCreated(mediaId: number): Promise<boolean>;
};

export type OwnerMediaEvidence = { authorityId: string; state: "UPLOADED_NEW" | "REUSED_EXISTING" | "ROLLED_BACK" | "FAILED"; mediaId: number | null; sourceUrl: string | null; sourceSha256: string; resultingSha256: string | null; transformationStatus: "BYTE_IDENTICAL" | "TRANSFORMED" | "UNKNOWN"; createdByTransaction: boolean; failure: string | null; recordedAt: string };
type EvidenceState = { records: OwnerMediaEvidence[] };
const NAMESPACE = "owner-supplied-media-ingestion";

function hash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function saveEvidence(evidence: OwnerMediaEvidence): void {
  const loaded = loadPersistedState<EvidenceState>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) });
  const records = [...loaded.state.records.filter((record) => record.authorityId !== evidence.authorityId), deepClone(evidence)];
  savePersistedState({ namespace: NAMESPACE, state: { records }, expectedRevision: loaded.revision });
}
export function listOwnerMediaEvidence(): readonly OwnerMediaEvidence[] { return loadPersistedState<EvidenceState>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) }).state.records; }
export function resetOwnerMediaEvidenceForTests(): void { resetPersistedState<EvidenceState>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) }); }

export function validateOwnerMediaAuthority(authority: OwnerMediaAuthority): boolean {
  return (["OWNER_SUPPLIED", "SSI_FIRST_PARTY", "VERIFIED_FACTORY_ASSET", "VERIFIED_INTERNAL_ASSET"] as const).includes(authority.sourceClass)
    && authority.uploadAuthorizationState === "APPROVED"
    && authority.mimeType === "image/png"
    && authority.byteSize > 0
    && authority.byteSize <= OWNER_MEDIA_MAX_BYTES
    && basename(authority.localPath) === authority.filename
    && Boolean(authority.title.trim())
    && Boolean(authority.altText.trim())
    && !/^https?:/i.test(authority.localPath);
}

export async function ingestOwnerSuppliedMedia(input: { authorityId: string; siteId: string }, transport: OwnerMediaTransport, loadBytes: (path: string) => Buffer = (path) => readFileSync(resolve(process.cwd(), path))): Promise<OwnerMediaEvidence> {
  const authority = OWNER_MEDIA_AUTHORITY_REGISTRY.find((entry) => entry.authorityId === input.authorityId);
  if (!authority || input.siteId !== authority.siteId || transport.hostname !== authority.hostname) throw new Error("OWNER_MEDIA_AUTHORITY_DENIED");
  if (!validateOwnerMediaAuthority(authority)) throw new Error("OWNER_MEDIA_REGISTRY_INVALID");
  const bytes = loadBytes(authority.localPath);
  if (bytes.length !== authority.byteSize || hash(bytes) !== authority.sha256 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("OWNER_MEDIA_SOURCE_MISMATCH");
  const existingEvidence = listOwnerMediaEvidence().find((record) => record.authorityId === authority.authorityId && record.mediaId && record.sourceUrl);
  const existing = existingEvidence ? await transport.read(existingEvidence.mediaId!) : await transport.findExact(authority);
  if (existing) {
    const resultBytes = await transport.readBytes(existing.url);
    if (!resultBytes || hash(resultBytes) !== authority.sha256 || existing.altText !== authority.altText || existing.title !== authority.title || new URL(existing.url).hostname.replace(/^www\./, "") !== authority.hostname) throw new Error("OWNER_MEDIA_EXISTING_IDENTITY_AMBIGUOUS");
    const evidence: OwnerMediaEvidence = { authorityId: authority.authorityId, state: "REUSED_EXISTING", mediaId: existing.id, sourceUrl: existing.url, sourceSha256: authority.sha256, resultingSha256: hash(resultBytes), transformationStatus: "BYTE_IDENTICAL", createdByTransaction: false, failure: null, recordedAt: new Date().toISOString() };
    saveEvidence(evidence); return evidence;
  }
  let uploaded: OwnerMediaRecord | null = null;
  try {
    uploaded = await transport.upload(authority, bytes);
    if (new URL(uploaded.url).hostname.replace(/^www\./, "") !== authority.hostname || uploaded.mimeType !== authority.mimeType) throw new Error("OWNER_MEDIA_RETURNED_IDENTITY_INVALID");
    if (!await transport.updateMetadata(uploaded.id, authority)) throw new Error("OWNER_MEDIA_METADATA_FAILED");
    const verified = await transport.read(uploaded.id), resultBytes = await transport.readBytes(uploaded.url);
    if (!verified || verified.id !== uploaded.id || verified.url !== uploaded.url || verified.title !== authority.title || verified.altText !== authority.altText || !resultBytes) throw new Error("OWNER_MEDIA_READBACK_FAILED");
    const resultingSha256 = hash(resultBytes), evidence: OwnerMediaEvidence = { authorityId: authority.authorityId, state: "UPLOADED_NEW", mediaId: uploaded.id, sourceUrl: uploaded.url, sourceSha256: authority.sha256, resultingSha256, transformationStatus: resultingSha256 === authority.sha256 ? "BYTE_IDENTICAL" : "TRANSFORMED", createdByTransaction: true, failure: null, recordedAt: new Date().toISOString() };
    saveEvidence(evidence); return evidence;
  } catch (error) {
    let rolledBack = false;
    if (uploaded) {
      const references = await transport.findReferences(uploaded.id);
      rolledBack = references.length === 0 && await transport.deleteCreated(uploaded.id);
    }
    saveEvidence({ authorityId: authority.authorityId, state: rolledBack ? "ROLLED_BACK" : "FAILED", mediaId: uploaded?.id ?? null, sourceUrl: uploaded?.url ?? null, sourceSha256: authority.sha256, resultingSha256: null, transformationStatus: "UNKNOWN", createdByTransaction: Boolean(uploaded), failure: error instanceof Error ? error.message : "UPLOAD_FAILED", recordedAt: new Date().toISOString() });
    throw error;
  }
}