import { describe, expect, it } from "@jest/globals";
import { createInMemoryManufacturingRepository } from "@/lib/gba/manufacturing-repository";
import { createManufacturingRuntimeService } from "@/lib/gba/manufacturing-runtime";

describe("gba manufacturing runtime", () => {
  it("produces deterministic recommendation checksums for identical input", async () => {
    const repository = createInMemoryManufacturingRepository();
    const runtime = createManufacturingRuntimeService(repository);

    const first = await runtime.listRecommendations("glw-led-display-warehouse");
    const second = await runtime.listRecommendations("glw-led-display-warehouse");

    const firstChecksums = first.map((entry) => `${entry.title}:${entry.deterministicChecksum}`).sort((a, b) => a.localeCompare(b));
    const secondChecksums = second.map((entry) => `${entry.title}:${entry.deterministicChecksum}`).sort((a, b) => a.localeCompare(b));

    expect(firstChecksums.length).toBeGreaterThan(0);
    expect(firstChecksums).toEqual(secondChecksums);
  });

  it("records recommendation reviews and timeline events", async () => {
    const repository = createInMemoryManufacturingRepository();
    const runtime = createManufacturingRuntimeService(repository);

    const generated = await runtime.listRecommendations("glw-led-display-warehouse");
    const reviewed = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      manufacturingRecommendationId: generated[0].manufacturingRecommendationId,
      actorId: "admin@example.com",
      decision: "APPROVED",
      notes: "Approved for rollout.",
    });

    const timeline = await runtime.listTimeline("glw-led-display-warehouse");

    expect(reviewed.decision).toBe("APPROVED");
    expect(timeline.some((entry) => entry.eventType === "RECOMMENDATION_REVIEWED")).toBe(true);
  });
});
