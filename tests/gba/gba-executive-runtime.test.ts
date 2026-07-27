import { describe, expect, it } from "@jest/globals";
import { createInMemoryExecutiveRepository } from "@/lib/gba/executive-repository";
import { createExecutiveRuntimeService } from "@/lib/gba/executive-runtime";

describe("gba executive runtime", () => {
  it("produces deterministic recommendation checksums for identical input", async () => {
    const repository = createInMemoryExecutiveRepository();
    const runtime = createExecutiveRuntimeService(repository);

    const first = await runtime.generateRecommendations({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
    });
    const second = await runtime.generateRecommendations({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
    });

    const firstChecksums = first.map((entry) => `${entry.title}:${entry.deterministicChecksum}`).sort((a, b) => a.localeCompare(b));
    const secondChecksums = second.map((entry) => `${entry.title}:${entry.deterministicChecksum}`).sort((a, b) => a.localeCompare(b));

    expect(firstChecksums.length).toBeGreaterThan(0);
    expect(firstChecksums).toEqual(secondChecksums);
  });

  it("records recommendation reviews and approval state", async () => {
    const repository = createInMemoryExecutiveRepository();
    const runtime = createExecutiveRuntimeService(repository);

    const generated = await runtime.generateRecommendations({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
    });

    const reviewed = await runtime.reviewRecommendation({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      recommendationId: generated[0].recommendationId,
      actorId: "admin@example.com",
      decision: "APPROVED",
      notes: "Approved for execution.",
    });

    const approvals = await runtime.listApprovals("glw-led-display-warehouse");
    const timeline = await runtime.listTimeline("glw-led-display-warehouse");

    expect(reviewed.decision).toBe("APPROVED");
    expect(approvals.some((entry) => entry.subjectType === "RECOMMENDATION" && entry.state === "APPROVED")).toBe(true);
    expect(timeline.some((entry) => entry.eventType === "RECOMMENDATION_REVIEWED")).toBe(true);
  });
});
