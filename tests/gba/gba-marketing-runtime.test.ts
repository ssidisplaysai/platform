import { describe, expect, it } from "@jest/globals";
import { createInMemoryMarketingRepository } from "@/lib/gba/marketing-repository";
import { createMarketingRuntimeService } from "@/lib/gba/marketing-runtime";
import { marketingId } from "@/lib/gba/marketing-models";

describe("gba marketing runtime", () => {
  it("persists campaign planning, recommendation review, and timeline events", async () => {
    const repository = createInMemoryMarketingRepository();
    const runtime = createMarketingRuntimeService(repository);

    const campaign = await runtime.createCampaignPlan({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      projectId: "project-1",
      actorId: "marketing@example.com",
      campaignName: "Launch Motion",
      objective: "Drive pipeline for the flagship platform launch.",
      channelFocus: ["organic_search", "email"],
      targetAudience: "Enterprise operators",
      budgetCents: 150000,
      expectedImpressions: 50000,
      expectedConversions: 120,
    });

    await repository.upsertRecommendation({
      marketingRecommendationId: marketingId("gbamktrec"),
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      projectId: "project-1",
      category: "content",
      title: "Refresh landing page headline",
      summary: "Headline should more directly reflect search intent.",
      recommendedAction: "Update the hero copy and validate with SEO criteria.",
      priority: "P1",
      confidence: "HIGH",
      status: "NEW",
      sourceReference: campaign.marketingCampaignPlanId,
      createdAt: new Date().toISOString(),
      immutableLineage: "test-lineage",
    });

    const review = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      projectId: "project-1",
      recommendationId: (await repository.listRecommendations("project-1"))[0].marketingRecommendationId,
      actorId: "marketing@example.com",
      decision: "APPROVED",
      notes: "Looks aligned to the launch plan.",
    });

    const campaigns = await runtime.listCampaignPlans("project-1");
    const timeline = await runtime.listTimeline("project-1");
    const health = await runtime.listHealth("project-1");

    expect(campaigns).toHaveLength(1);
    expect(review.decision).toBe("APPROVED");
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(health[0].status).toBe("DEGRADED");
  });
});
