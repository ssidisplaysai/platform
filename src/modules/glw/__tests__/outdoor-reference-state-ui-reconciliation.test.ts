jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GlwCampaign } from "../campaign-types";
import type { GlwPageExecutionRecord } from "../page-execution";
import {
  findEvidenceBoundLegacyReferenceJob,
  projectGlwReferenceRetryReadiness,
  projectGlwReferenceWorkflow,
} from "../reference-workflow-state";

const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
const failedJobId = "3df15069-2cd8-4aec-93f3-70a9f5ee3029";
const failedArtifactSha = "eed2b6450c8ba975c78e51e5f603993a4306632e48946ffb64c2128b7b404371";

describe("Outdoor reference state UI reconciliation", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-outdoor-reference-state-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
    rmSync(root, { recursive: true, force: true });
  });

  test("persists Indiana across reload instead of reverting to the first state", async () => {
    const first = await import("../reference-state-selection-repository");
    first.saveGlwReferenceStateSelection({
      campaignId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      stateCode: "IN",
      selectedBy: "genesis-operator-robert",
      selectedAt: "2026-09-14T22:31:43.833Z",
    });
    jest.resetModules();
    const reloaded = await import("../reference-state-selection-repository");
    expect(reloaded.getGlwReferenceStateSelection(campaignId)).toMatchObject({ stateCode: "IN" });
  });

  test("projects the evidence-bound Illinois failure as an Indiana retry", () => {
    const campaign = {
      campaignId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      stateCodes: ["AL", "IL", "IN"],
      createdAt: "2026-09-11T08:27:18.082Z",
    } as GlwCampaign;
    const html = "preserved failed artifact";
    const failedJob = {
      jobId: failedJobId,
      campaignId: null,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      productId: campaign.productId,
      state: "Illinois",
      status: "FAILED",
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      qaFailureReasons: { stateProductAuthorityLink: "missing" },
      generatedDraft: { contentHtml: html },
      createdAt: "2026-09-14T21:33:29.878Z",
      updatedAt: "2026-09-14T21:34:34.294Z",
    } as GlwPageExecutionRecord;
    const recovered = findEvidenceBoundLegacyReferenceJob({ campaign, campaigns: [campaign], records: [failedJob] });
    const workflow = projectGlwReferenceRetryReadiness(projectGlwReferenceWorkflow(recovered), "IN", true);
    expect(workflow).toMatchObject({
      state: "REFERENCE_RETRY_READY",
      operationId: failedJobId,
      targetStateCode: "IL",
      nextReferenceStateCode: "IN",
      retryRequiresNewOwnerAuthorization: true,
      retryExecutable: false,
      artifactSha256: createHash("sha256").update(html).digest("hex"),
    });
  });

  test("route and UI prefer durable state and require fresh preflight", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8").replace(/\s/g, "");
    const page = readFileSync(join(process.cwd(), "src/app/glw/campaigns/[campaignId]/page.tsx"), "utf8").replace(/\s/g, "");
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    expect(route).toContain('stateCode:durableSelection?.stateCode??request.nextUrl.searchParams.get("stateCode")??""');
    expect(route).toContain("findEvidenceBoundLegacyReferenceJob");
    expect(page).toContain("initialReferenceState={referenceStateSelection?.stateCode}");
    for (const marker of ["ReferenceState:", "ReferenceGenerationRetry", "FailedState:Illinois(IL)", "FailedJobID:", "FailedArtifactSHA-256:", "RunRetryPreflight", "AuthorizeOneRetry"])
      expect(ui).toContain(marker);
    expect(ui).toContain("!ownerPreflightReceiptId");
    expect(ui).toContain("existingOperationBlocksGeneration");
    expect(failedArtifactSha).toHaveLength(64);
  });
});