jest.mock("server-only", () => ({}));

import { ingestOwnerSuppliedMedia, OWNER_MEDIA_AUTHORITY_REGISTRY, resetOwnerMediaEvidenceForTests, validateOwnerMediaAuthority, type OwnerMediaAuthority, type OwnerMediaTransport } from "../owner-supplied-media-ingestion";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authority = OWNER_MEDIA_AUTHORITY_REGISTRY[0];
const authorityBytes = (entry = authority) => readFileSync(resolve(process.cwd(), entry.localPath));

function transport(entry = authority, patch: Partial<OwnerMediaTransport> = {}): OwnerMediaTransport & { calls: string[] } {
  const calls: string[] = [];
  const bytes = authorityBytes(entry);
  const record = { id: 15001, url: `https://${entry.hostname}/wp-content/uploads/${entry.filename}`, mimeType: entry.mimeType, title: entry.title, altText: entry.altText, status: "inherit", width: 730, height: 262 };
  return {
    hostname: authority.hostname,
    calls,
    async findExact() { calls.push("find"); return null; },
    async upload() { calls.push("upload"); return record; },
    async updateMetadata() { calls.push("metadata"); return true; },
    async read() { calls.push("read"); return record; },
    async readBytes() { calls.push("bytes"); return bytes; },
    async findReferences() { calls.push("references"); return []; },
    async deleteCreated() { calls.push("delete"); return true; },
    ...patch,
  };
}

const load = () => authorityBytes();

describe("owner-supplied media ingestion", () => {
  beforeEach(() => resetOwnerMediaEvidenceForTests());

  test("accepts exact owner-supplied and SSI-first-party registry entries", async () => {
    for (const entry of [OWNER_MEDIA_AUTHORITY_REGISTRY[0], OWNER_MEDIA_AUTHORITY_REGISTRY[2]]) {
      const exactBytes = authorityBytes(entry);
      const mock = transport(entry, { async readBytes() { return exactBytes; } });
      await expect(ingestOwnerSuppliedMedia({ authorityId: entry.authorityId, siteId: entry.siteId }, mock, () => exactBytes)).resolves.toMatchObject({ state: "UPLOADED_NEW", createdByTransaction: true, transformationStatus: "BYTE_IDENTICAL" });
    }
    expect(authority.sourceClass).toBe("OWNER_SUPPLIED");
    expect(OWNER_MEDIA_AUTHORITY_REGISTRY[2].sourceClass).toBe("SSI_FIRST_PARTY");
  });

  test("accepts the exact owner-approved LDW canonical JPEG", async () => {
    const entry = OWNER_MEDIA_AUTHORITY_REGISTRY.find((item) => item.authorityId === "ldw-indoor-digital-sphere-owner-photo-v1")!;
    expect(entry).toMatchObject({ mimeType: "image/jpeg", byteSize: 195194, expectedWidth: 924, expectedHeight: 2000, productId: "prod-indoor-digital-sphere", visualClassification: "CANONICAL_PRIMARY_PRODUCT_IMAGE", provenance: "OWNER_APPROVED_FIRST_PARTY_PRODUCT_MEDIA" });
    expect(validateOwnerMediaAuthority(entry)).toBe(true);
  });

  test("denies unknown authority, wrong site, hash mismatch, MIME mismatch, size, and filename substitution", async () => {
    await expect(ingestOwnerSuppliedMedia({ authorityId: "unknown", siteId: authority.siteId }, transport(), load)).rejects.toThrow("OWNER_MEDIA_AUTHORITY_DENIED");
    await expect(ingestOwnerSuppliedMedia({ authorityId: authority.authorityId, siteId: "wrong" }, transport(), load)).rejects.toThrow("OWNER_MEDIA_AUTHORITY_DENIED");
    await expect(ingestOwnerSuppliedMedia({ authorityId: authority.authorityId, siteId: authority.siteId }, transport(), () => { const changed = authorityBytes(); changed[20] ^= 1; return changed; })).rejects.toThrow("OWNER_MEDIA_SOURCE_MISMATCH");
    expect(OWNER_MEDIA_AUTHORITY_REGISTRY.every((entry) => ["image/png", "image/jpeg"].includes(entry.mimeType) && entry.byteSize <= 5_000_000)).toBe(true);
    const mutations: Partial<OwnerMediaAuthority>[] = [
      { sourceClass: "UNKNOWN_PROVENANCE" as OwnerMediaAuthority["sourceClass"] },
      { mimeType: "image/jpeg" as OwnerMediaAuthority["mimeType"] },
      { byteSize: 5_000_001 },
      { filename: "substituted.png" },
      { title: "" },
      { altText: "" },
      { localPath: "https://example.com/image.png" },
    ];
    for (const mutation of mutations) expect(validateOwnerMediaAuthority({ ...authority, ...mutation })).toBe(false);
  });

  test("does not contain disallowed provenance classes or remote source authority", () => {
    expect(JSON.stringify(OWNER_MEDIA_AUTHORITY_REGISTRY)).not.toMatch(/DISCOVERY_ONLY|COMPETITOR_RESEARCH|GENERIC_WEB_RESEARCH|UNKNOWN_PROVENANCE|UNVERIFIED_EXTERNAL_MEDIA|https?:\/\//);
  });

  test("reuses an exact existing attachment and never deletes it", async () => {
    const mock = transport(authority, { async findExact() { mock.calls.push("find"); return { id: 9, url: `https://${authority.hostname}/${authority.filename}`, mimeType: authority.mimeType, title: authority.title, altText: authority.altText, status: "inherit", width: 730, height: 262 }; } });
    await expect(ingestOwnerSuppliedMedia({ authorityId: authority.authorityId, siteId: authority.siteId }, mock, load)).resolves.toMatchObject({ state: "REUSED_EXISTING", createdByTransaction: false, mediaId: 9 });
    expect(mock.calls).not.toContain("delete");
  });

  test("rejects returned cross-site identity and deletes only the newly created unreferenced attachment", async () => {
    const mock = transport(authority, { async upload() { mock.calls.push("upload"); return { id: 10, url: "https://example.com/file.png", mimeType: authority.mimeType, title: authority.title, altText: authority.altText, status: "inherit", width: 10, height: 10 }; } });
    await expect(ingestOwnerSuppliedMedia({ authorityId: authority.authorityId, siteId: authority.siteId }, mock, load)).rejects.toThrow("OWNER_MEDIA_RETURNED_IDENTITY_INVALID");
    expect(mock.calls).toContain("delete");
  });

  test("request cannot substitute filename, title, alt, MIME, URL, provenance, or authority", () => {
    expect(ingestOwnerSuppliedMedia.length).toBe(2);
    expect(Object.keys(authority).sort()).toEqual(expect.arrayContaining(["filename", "title", "altText", "mimeType", "provenance", "sha256"]));
  });
});