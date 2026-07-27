import { describe, expect, it } from "@jest/globals";
import { createInMemorySalesRepository } from "@/lib/gba/sales-repository";
import { createSalesRuntimeService } from "@/lib/gba/sales-runtime";
import { salesId } from "@/lib/gba/sales-models";

describe("gba sales runtime", () => {
  it("creates pipeline records and persists recommendation reviews", async () => {
    const repository = createInMemorySalesRepository();
    const runtime = createSalesRuntimeService(repository);

    const created = await runtime.createPipelineRecord({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "sales@example.com",
      accountId: "acct-1",
      accountName: "Apollo Dynamics",
      opportunityReference: "opp-new-1",
      stage: "QUALIFIED",
      amountCents: 2000000,
      probabilityPercent: 45,
      expectedCloseAt: new Date().toISOString(),
    });

    await repository.upsertRecommendation({
      salesRecommendationId: salesId("gbasalesrec"),
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      category: "PIPELINE",
      title: "Re-rank qualification criteria",
      summary: "Legacy qualification rules are underperforming.",
      recommendedAction: "Adopt weighted qualification scoring.",
      priority: "P1",
      confidence: "MEDIUM",
      status: "NEW",
      sourceReference: created.salesPipelineRecordId,
      createdAt: new Date().toISOString(),
      immutableLineage: "lineage",
    });

    const review = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "sales@example.com",
      salesRecommendationId: (await repository.listRecommendations("glw-led-display-warehouse"))[0].salesRecommendationId,
      decision: "APPROVED",
      notes: "Approve for next planning cycle.",
    });

    const pipeline = await runtime.listPipeline("glw-led-display-warehouse", "genesis");
    const timeline = await runtime.listTimeline("glw-led-display-warehouse", "genesis");
    const health = await runtime.listHealth("glw-led-display-warehouse", "genesis");

    expect(pipeline.length).toBeGreaterThan(0);
    expect(review.decision).toBe("APPROVED");
    expect(timeline.length).toBeGreaterThan(0);
    expect(health[0]).toBeDefined();
  });
});
