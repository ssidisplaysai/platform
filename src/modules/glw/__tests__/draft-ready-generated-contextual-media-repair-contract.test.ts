import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("draft-ready generated contextual media repair contract", () => {
  test("adds a dedicated page-level repair endpoint and operation", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/pages/[jobId]/generated-contextual-media-repair/route.ts"),
      "utf8",
    );

    expect(route).toContain("REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA");
    expect(route).toContain("buildGeneratedPageReviewModel");
    expect(route).toContain("requiresGeneratedContextualMediaForOutdoorSphere");
    expect(route).toContain("Draft-ready contextual repair identity mismatch");
  });

  test("reuses contextual production systems while skipping auto visual recertification", () => {
    const service = readFileSync(
      join(process.cwd(), "src/modules/glw/contextual-media-production-service.ts"),
      "utf8",
    );

    expect(service).toContain("draftReadyContextualRepairPlan");
    expect(service).toContain("slot: \"POST_HERO_CONTEXTUAL\"");
    expect(service).toContain("buildOutdoorSphereGeneratedContextualPrompt");
    expect(service).toContain("SKIPPED_DRAFT_READY_REPAIR");
    expect(service).toContain("visualCertificationPerformed: false");
  });

  test("review workspace exposes a dedicated generated contextual repair control", () => {
    const readModel = readFileSync(
      join(process.cwd(), "src/modules/glw/generated-page-review-read-model.ts"),
      "utf8",
    );
    const workspace = readFileSync(
      join(process.cwd(), "src/modules/glw/GlwGeneratedPageReviewWorkspace.tsx"),
      "utf8",
    );

    expect(readModel).toContain("generatedContextualRepairEligible");
    expect(readModel).toContain("generatedContextualRepair");
    expect(workspace).toContain("GlwGeneratedContextualMediaRepairAction");
  });
});
