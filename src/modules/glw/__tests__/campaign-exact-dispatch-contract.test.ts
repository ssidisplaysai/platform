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

    expect(route).toContain('body?.confirm === "RUN_EXACT_DRAFT_TARGETS"');
    expect(route).toContain("Exact dispatch targets must match the next deterministic queued targets.");
    expect(route).toContain("pagesPerDay: campaign.pagesPerDay");
    expect(route).toContain("maxTargets: requestedTargets.length");
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
});