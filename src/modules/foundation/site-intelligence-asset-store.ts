import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePersistenceRoot } from "./foundation-persistence";
import type { SiteAssetClassification, SiteIntelligenceBinaryAsset } from "./site-intelligence";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function safeSegment(value: string): string {
  const safe = value.trim().replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safe || safe.includes("..")) throw new Error("UNSAFE_ASSET_IDENTITY");
  return safe;
}

function signatureMatches(mediaType: string, bytes: Uint8Array): boolean {
  if (mediaType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mediaType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mediaType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mediaType === "image/gif") return String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a" || String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a";
  if (mediaType === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export function storeSiteIntelligenceAsset(input: {
  organizationId: string;
  siteId: string;
  originalFileName: string;
  mediaType: string;
  bytes: Uint8Array;
  actor: string;
  classification: SiteAssetClassification;
  note: string | null;
  now?: () => string;
}): SiteIntelligenceBinaryAsset {
  if (!ALLOWED.has(input.mediaType)) throw new Error("UNSUPPORTED_ASSET_MEDIA_TYPE");
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_FILE_BYTES) throw new Error("ASSET_SIZE_OUT_OF_BOUNDS");
  if (!signatureMatches(input.mediaType, input.bytes)) throw new Error("ASSET_SIGNATURE_MISMATCH");
  const organizationId = safeSegment(input.organizationId);
  const siteId = safeSegment(input.siteId);
  const fileName = safeSegment(input.originalFileName);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const assetId = `site-asset-${sha256}`;
  const relative = join("site-intelligence-assets", organizationId, siteId, `${sha256}.bin`);
  const target = join(resolvePersistenceRoot(), relative);
  mkdirSync(join(resolvePersistenceRoot(), "site-intelligence-assets", organizationId, siteId), { recursive: true });
  if (!existsSync(target)) writeFileSync(target, input.bytes, { flag: "wx" });
  const uploadedAt = (input.now ?? (() => new Date().toISOString()))();
  return { assetId, sha256, originalFileName: fileName, mediaType: input.mediaType, sizeBytes: input.bytes.byteLength, uploadedAt, uploadedBy: input.actor, organizationId: input.organizationId, siteId: input.siteId, providerReference: relative.replace(/\\/g, "/"), provenance: { sourceType: "OWNER_UPLOAD", sourceReference: fileName, recordedAt: uploadedAt }, classification: input.classification, note: input.note };
}

export function readSiteIntelligenceAsset(asset: SiteIntelligenceBinaryAsset): Buffer {
  const root = resolvePersistenceRoot();
  const target = join(root, ...asset.providerReference.split("/"));
  if (!target.startsWith(join(root, "site-intelligence-assets"))) throw new Error("UNSAFE_ASSET_REFERENCE");
  const bytes = readFileSync(target);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) throw new Error("ASSET_DIGEST_MISMATCH");
  return bytes;
}