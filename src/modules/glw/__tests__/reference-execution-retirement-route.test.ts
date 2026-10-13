import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(
  join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-execution-retirement/route.ts"),
  "utf8",
);

describe("reference execution retirement route", () => {
  test("requires explicit governed confirmation and operation", () => {
    expect(route).toContain("RETIRE_REFERENCE_EXECUTION_FOR_ACTIVE_PROJECTION");
    expect(route).toContain("GLW_REFERENCE_EXECUTION_RETIRE_OPERATION");
    expect(route).toContain("Explicit governed reference execution retirement request is required.");
  });

  test("is lifecycle-only and does not run generation or publication", () => {
    expect(route).toContain("generationAttempted: false");
    expect(route).toContain("publicationPerformed: false");
    expect(route).toContain("wordpressMutationPerformed: false");
    expect(route).not.toContain("/api/glw/page-generation");
    expect(route).not.toContain("writeGenesisWordPressDraft");
  });
});
