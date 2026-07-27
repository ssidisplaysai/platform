import { describe, expect, it } from "@jest/globals";
import { createInMemoryCustomerSuccessRepository } from "@/lib/gba/customer-success-repository";
import { createCustomerSuccessRuntimeService } from "@/lib/gba/customer-success-runtime";

describe("gba customer success runtime", () => {
  it("generates dashboard data and recommendation review lineage", async () => {
    const repository = createInMemoryCustomerSuccessRepository();
    const runtime = createCustomerSuccessRuntimeService(repository);

    const dashboard = await runtime.getDashboard("glw-led-display-warehouse", "genesis");
    const recommendations = await runtime.listRecommendations("glw-led-display-warehouse", "genesis");

    expect(dashboard.workspaceId).toBe("glw-led-display-warehouse");
    expect(recommendations.length).toBeGreaterThan(0);

    const review = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "customer-success@example.com",
      customerSuccessRecommendationId: recommendations[0].customerSuccessRecommendationId,
      decision: "APPROVED",
      notes: "Approved for customer success operating cadence.",
    });

    const timeline = await runtime.listTimeline("glw-led-display-warehouse", "genesis");
    const health = await runtime.listHealth("glw-led-display-warehouse", "genesis");

    expect(review.decision).toBe("APPROVED");
    expect(timeline.length).toBeGreaterThan(0);
    expect(health[0]).toBeDefined();
  });
});
