import { describe, expect, it } from "@jest/globals";
import { createInMemoryFinanceRepository } from "@/lib/gba/finance-repository";
import { createFinanceRuntimeService } from "@/lib/gba/finance-runtime";

describe("gba finance runtime", () => {
  it("generates dashboard data and recommendation review lineage", async () => {
    const repository = createInMemoryFinanceRepository();
    const runtime = createFinanceRuntimeService(repository);

    const dashboard = await runtime.getDashboard("glw-led-display-warehouse", "genesis");
    const recommendations = await runtime.listRecommendations("glw-led-display-warehouse", "genesis");

    expect(dashboard.workspaceId).toBe("glw-led-display-warehouse");
    expect(recommendations.length).toBeGreaterThan(0);

    const review = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "finance@example.com",
      financeRecommendationId: recommendations[0].financeRecommendationId,
      decision: "APPROVED",
      notes: "Approved for execution in finance operating cadence.",
    });

    const timeline = await runtime.listTimeline("glw-led-display-warehouse", "genesis");
    const health = await runtime.listHealth("glw-led-display-warehouse", "genesis");

    expect(review.decision).toBe("APPROVED");
    expect(timeline.length).toBeGreaterThan(0);
    expect(health[0]).toBeDefined();
  });
});
