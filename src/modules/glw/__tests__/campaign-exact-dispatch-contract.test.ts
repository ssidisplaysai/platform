import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

jest.mock("server-only", () => ({}));

describe("campaign exact dispatch contract", () => {
  test("requires deterministic prefix selection and preserves campaign rate accounting", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/scheduler/route.ts"),
      "utf8",
    );
    const repository = readFileSync(
      join(process.cwd(), "src/modules/glw/campaign-target-repository.ts"),
      "utf8",
    );
    const controls = readFileSync(
      join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"),
      "utf8",
    );
    const detailPage = readFileSync(
      join(process.cwd(), "src/app/glw/campaigns/[campaignId]/page.tsx"),
      "utf8",
    );

    expect(route).toContain('body?.confirm === "RUN_EXACT_DRAFT_TARGETS"');
    expect(route).toContain("Exact dispatch targets must match the next deterministic queued targets.");
    expect(route).toContain("pagesPerDay: campaign.pagesPerDay");
    expect(route).toContain("const MAX_CONCURRENT_EXECUTION = 1");
    expect(route).toContain("maxTargets: MAX_CONCURRENT_EXECUTION");
    expect(route).toContain("GLW_N8N_MCP_NOT_CONFIGURED");
    expect(route.indexOf("GLW_N8N_MCP_NOT_CONFIGURED")).toBeLessThan(route.indexOf("leaseGlwCampaignTargets({"));
    expect(route).toContain('payload?.job?.status === "FAILED"');
    expect(controls).toContain("!scheduler.executionReadiness.configured");
    expect(controls).toContain("No target will be leased while execution authority is unavailable.");
    expect(controls).toContain('`${target.cityName}, ${target.stateCode}`');
    expect(detailPage).toContain('`${target.cityName}, ${target.stateCode}`');
    expect(repository).toContain("Math.min(allowance, input.maxTargets ?? allowance)");
  });

  test("leases only the requested deterministic prefix", async () => {
    const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    const root = mkdtempSync(join(tmpdir(), "glw-exact-dispatch-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    jest.resetModules();
    try {
      const repository = await import("../campaign-target-repository");
      repository.initializeGlwCampaignTargets({
        campaignId: "campaign-exact",
        organizationId: "org",
        siteId: "site",
        productId: "product",
        stateCodes: ["CA", "TN", "TX"],
        referenceStateCode: "CA",
        referenceJobId: "reference-job",
        referenceWordpressObjectId: "1",
      });
      expect(repository.previewGlwCampaignTargetLease({ campaignId: "campaign-exact", pagesPerDay: 10, dispatchDate: "2026-09-05", maxTargets: 1 }).selected.map((target) => target.stateCode)).toEqual(["TN"]);
      expect(repository.leaseGlwCampaignTargets({ campaignId: "campaign-exact", pagesPerDay: 10, dispatchDate: "2026-09-05", leaseId: "lease", maxTargets: 1 }).map((target) => target.stateCode)).toEqual(["TN"]);
      expect(repository.listGlwCampaignTargets("campaign-exact").find((target) => target.stateCode === "TX")?.status).toBe("queued");
    } finally {
      if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
      else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requeues only the exact pre-execution failed target", async () => {
    const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    const root = mkdtempSync(join(tmpdir(), "glw-pre-execution-requeue-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    jest.resetModules();
    try {
      const repository = await import("../campaign-target-repository");
      repository.initializeGlwCampaignTargets({
        campaignId: "campaign-requeue",
        organizationId: "org",
        siteId: "site",
        productId: "product",
        stateCodes: ["CA", "TX"],
        referenceStateCode: "CA",
        referenceJobId: "reference-job",
        referenceWordpressObjectId: "1",
      });
      repository.leaseGlwCampaignTargets({ campaignId: "campaign-requeue", pagesPerDay: 10, dispatchDate: "2026-09-12", leaseId: "lease", maxTargets: 1 });
      repository.attachGlwCampaignTargetJob({ campaignId: "campaign-requeue", stateCode: "TX", leaseId: "lease", jobId: "failed-job" });
      const recovered = repository.requeueGlwCampaignTargetAfterPreExecutionFailure({ campaignId: "campaign-requeue", stateCode: "TX", jobId: "failed-job", error: "Transport unavailable." });
      expect(recovered).toMatchObject({ status: "queued", jobId: null, leaseId: null, attemptCount: 1, lastError: "Transport unavailable." });
    } finally {
      if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
      else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
      rmSync(root, { recursive: true, force: true });
    }
  });
});