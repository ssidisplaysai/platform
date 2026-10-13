jest.mock("server-only", () => ({}));

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { GlwLocalReferenceDraft } from "../campaign-local-reference-repository";
import { generateProjectorEnclosureReferenceVisual } from "../projector-enclosure-reference-image-service";

const originalDirectory = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
let directory: string;
const scope = {
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  campaignId: "campaign-projector-texas",
  referenceDraftId: "reference-austin",
};

beforeEach(() => {
  jest.resetModules();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "campaign-reference-image-"));
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory;
});
afterEach(() => {
  if (originalDirectory === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalDirectory;
  fs.rmSync(directory, { recursive: true, force: true });
});

function reference(): GlwLocalReferenceDraft {
  return {
    referenceDraftId: scope.referenceDraftId, campaignId: scope.campaignId, organizationId: scope.organizationId,
    siteId: scope.siteId, productId: "prod-ssi-fan-cooled-projector-enclosures", stateCode: "TX", citySlug: "austin",
    cityName: "Austin", canonicalPath: "fan-cooled-projector-enclosures/texas/austin", revision: 1,
    status: "READY_FOR_OWNER_REVIEW", title: "Austin", seoTitle: "Austin", metaDescription: "Austin", h1: "Austin",
    excerpt: "Austin", sections: [], internalLinks: [], image: { required: true, requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL", status: "MISSING", assetReference: null, classification: null, altText: null, ownerApproved: false },
    provenance: { parentCampaignId: "parent", knowledgePackRevision: 1, authorityReferences: ["product:approved"] },
    reviewInstructions: null, createdAt: "2030-01-01", updatedAt: "2030-01-01",
  };
}

describe("campaign reference image candidates", () => {
  test("stores immutable GENERATED_VISUAL revisions and explicit owner decisions", async () => {
    const repository = await import("../campaign-reference-image-candidate-repository");
    const jpeg = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#223344" } }).jpeg().toBuffer();
    const common = {
      ...scope,
      requirementPurpose: "PROJECTOR_ENCLOSURE_APPLICATION_VISUAL" as const,
      sourceType: "GENERATED_VISUAL" as const,
      mimeType: "image/jpeg" as const,
      bytes: jpeg,
      generationPrompt: "Neutral product visual",
      visualBrief: "Approved enclosure as a non-documentary visual",
      sourceAssetReference: "wordpress-media:10757",
      imageProfileReference: "profile-image-projectorenclosure-product",
      knowledgePackRevision: 1,
      authorityReferences: ["product:approved"],
      altText: "Illustrative fan-cooled projector enclosure",
      actor: "platform_admin",
    };
    const first = repository.saveGlwReferenceImageCandidate(common);
    const second = repository.saveGlwReferenceImageCandidate({ ...common, ownerInstructions: "Use a quieter treatment" });
    expect(second).toMatchObject({ revision: 2, priorCandidateId: first.candidateId, sourceType: "GENERATED_VISUAL", status: "READY_FOR_OWNER_REVIEW", generationBasis: { provider: "LOCAL_GOVERNED_COMPOSITOR", referenceOnlyInputsUsed: false, competitorInputsUsed: false } });
    expect(repository.readGlwReferenceImageCandidateBytes({ ...scope, candidateId: second.candidateId })?.bytes).toEqual(jpeg);
    expect(repository.decideGlwReferenceImageCandidate({ ...scope, candidateId: second.candidateId, decision: "APPROVE", actor: "platform_admin" })).toMatchObject({ status: "APPROVED", decidedBy: "platform_admin" });
    expect(() => repository.decideGlwReferenceImageCandidate({ ...scope, candidateId: second.candidateId, decision: "REJECT", actor: "platform_admin" })).toThrow("NOT_REVIEWABLE");
  });

  test("creates a real JPEG derived from the exact approved owner asset and labels provenance", async () => {
    const source = await sharp({ create: { width: 2560, height: 1152, channels: 3, background: "#17212b" } }).webp().toBuffer();
    const generated = await generateProjectorEnclosureReferenceVisual({
      reference: reference(),
      fetcher: async () => new Response(source, { status: 200, headers: { "content-type": "image/webp" } }),
    });
    const metadata = await sharp(generated.bytes).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 1536, height: 1024 });
    expect(generated).toMatchObject({ mimeType: "image/jpeg", sourceAssetReference: "wordpress-media:10757" });
    expect(generated.generationPrompt).toContain("not documentary evidence");
    expect(generated.generationPrompt).toContain("Do not add logos");
  });
});
