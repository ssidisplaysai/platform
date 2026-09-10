import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readSiteIntelligenceAsset, storeSiteIntelligenceAsset } from "../site-intelligence-asset-store";
import { isPublishableSiteAsset } from "../site-intelligence";

describe("site intelligence binary assets", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-assets-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = dir; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }); });

  test("persists scoped immutable metadata, digest, bytes and provenance", () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const asset = storeSiteIntelligenceAsset({ organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", originalFileName: "owner logo.png", mediaType: "image/png", bytes, actor: "owner", classification: "OWNER_SUPPLIED_REFERENCE", note: "Reference only", now: () => "2026-09-10T00:00:00.000Z" });
    expect(asset).toMatchObject({ organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", originalFileName: "owner_logo.png", mediaType: "image/png", sizeBytes: 7, uploadedBy: "owner", classification: "OWNER_SUPPLIED_REFERENCE", provenance: { sourceType: "OWNER_UPLOAD", sourceReference: "owner_logo.png" } });
    expect(asset.assetId).toBe(`site-asset-${asset.sha256}`);
    expect(readSiteIntelligenceAsset(asset)).toEqual(Buffer.from(bytes));
    expect(fs.readdirSync(dir)).toEqual(["site-intelligence-assets"]);
  });

  test("rejects disguised and unsupported files", () => {
    expect(() => storeSiteIntelligenceAsset({ organizationId: "rj-metal", siteId: "site-1", originalFileName: "bad.png", mediaType: "image/png", bytes: Uint8Array.from([1, 2, 3]), actor: "owner", classification: "UNVERIFIED", note: null })).toThrow("SIGNATURE");
    expect(() => storeSiteIntelligenceAsset({ organizationId: "rj-metal", siteId: "site-1", originalFileName: "bad.svg", mediaType: "image/svg+xml", bytes: Uint8Array.from([1]), actor: "owner", classification: "UNVERIFIED", note: null })).toThrow("MEDIA_TYPE");
  });

  test("only explicit owner-approved classification is publishable", () => {
    expect(isPublishableSiteAsset("OWNER_SUPPLIED_REFERENCE")).toBe(false);
    expect(isPublishableSiteAsset("COMPETITOR_REFERENCE_ONLY")).toBe(false);
    expect(isPublishableSiteAsset("OWNER_APPROVED_PUBLISHABLE")).toBe(true);
  });
});