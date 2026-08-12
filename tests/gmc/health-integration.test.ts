import { describe, expect, it } from "@jest/globals";
import { createHealthSummaryService } from "@/platform/gmc";
import { createMockHealthService } from "./fixtures";

describe("GMC health integration", () => {
  it("consumes health data from EHC without computing health states", async () => {
    const healthService = createHealthSummaryService({ healthService: createMockHealthService() });
    const summary = await healthService.enterpriseSummary();

    expect(summary.enterpriseState).toBe("DEGRADED");
    expect(summary.enterpriseReadiness).toBe("NOT_READY");
  });
});
