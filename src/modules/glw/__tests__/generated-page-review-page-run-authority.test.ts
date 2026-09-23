import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("generated page review PageRun authority", () => {
  test("resolves review target from the authoritative PageRun when legacy job binding is absent", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/glw/generated-page-review-read-model.ts"),
      "utf8",
    );

    expect(source).toContain("glwPageRunRepository.getByGenerationJobId(job.jobId)");
    expect(source).toContain("entry.targetId === pageRun.targetId");
    expect(source).toContain("projectReviewTargetFromPageRun(storedTarget, pageRun)");
    expect(source).toContain('run.status === "WORDPRESS_DRAFT" || run.status === "APPROVED"');
    expect(source).toContain('? "draft_ready"');
  });
});
