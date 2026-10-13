jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContextualGenerationReceipt } from "@/modules/glw/contextual-media-production-adapter";

describe("generated contextual media repository", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "generated-contextual-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; jest.resetModules(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test("persists complete provenance and bytes and reuses exact successful identity", async () => {
    const repository = await import("../generated-contextual-media-repository");
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    const receipt: ContextualGenerationReceipt = { authority: "GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1", generationId: `contextual-generation-${"a".repeat(64)}`, organizationId: "org", siteId: "site", campaignId: "campaign", targetId: "target", productId: "product", wordpressObjectId: "10", pageRevisionId: "revision", role: "EVENT_EXPERIENCE", mediaRole: "APPLICATION_EXPERIENCE", slot: "APPLICATION_STAGE", promptFingerprint: "b".repeat(64), provider: "OPENAI_IMAGE", model: "gpt-image-2", outputDimensions: { width: 1536, height: 1024 }, generationCount: 1, selectedOutputCount: 1, latencyMs: 123, reportedCost: "UNKNOWN", assetSha256: createHash("sha256").update(bytes).digest("hex"), mimeType: "image/jpeg", documentaryEvidence: false, actualInstallationEvidence: false, productSpecificationAuthority: false, customerEvidence: false, status: "SUCCEEDED", createdAt: "2030-01-01T00:00:00.000Z" };
    const first = repository.saveSuccessfulGeneratedContextualMedia({ receipt, bytes });
    const found = repository.findSuccessfulGeneratedContextualMedia({ identity: receipt, role: receipt.role, promptFingerprint: receipt.promptFingerprint });
    expect(found).toEqual(first);
    expect(found?.bytes).toEqual(bytes);
    expect(repository.saveSuccessfulGeneratedContextualMedia({ receipt, bytes })).toEqual(first);
    expect(repository.listGeneratedContextualMedia({ organizationId: "org", siteId: "site", targetId: "target" })).toMatchObject([{ provider: "OPENAI_IMAGE", model: "gpt-image-2", reportedCost: "UNKNOWN", byteSize: bytes.length, documentaryEvidence: false, actualInstallationEvidence: false, productSpecificationAuthority: false, customerEvidence: false }]);
  });
});