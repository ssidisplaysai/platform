import { readFileSync } from "node:fs";
import { join } from "node:path";

const script = readFileSync(join(process.cwd(), "scripts/ssi-accent-multi-state-readonly-audit.mts"), "utf8");
const report = readFileSync(join(process.cwd(), "docs/genesis/ssi-accent-multi-state-benchmark-rehabilitation-v1.md"), "utf8");

describe("SSI Accent multi-state rehabilitation audit", () => {
  test("is exact-campaign scoped and performs WordPress reads only", () => {
    expect(script).toContain("campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark");
    expect(script).toContain('method: "GET"');
    expect(script).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
    expect(script).not.toMatch(/savePersistedState|writeGenesisWordPress|service\.execute|leaseGlwCampaignTargets/);
  });

  test("audits all current claim, localization, product, media, composition, SEO, and navigation surfaces", () => {
    for (const marker of [
      "evaluateGlwReferenceClaimAuthority", "wrongStateContaminationCount", "productAuthority",
      "featuredMedia", "artifactStoredRelation", "h1Count", "responsiveStatus",
      "contrastStatus", "seoTitle", "navigationStatus",
    ]) expect(script).toContain(marker);
  });

  test("defines every target decision, systemic remediation, publication gate, and operator gap", () => {
    for (const state of ["AZ Arizona", "CA California", "CO Colorado", "CT Connecticut", "FL Florida", "GA Georgia", "IL Illinois", "NC North Carolina", "NY New York", "TN Tennessee"]) {
      expect(report).toContain(state);
    }
    for (const marker of ["REFERENCE_RECERTIFY", "DRAFT_DETERMINISTIC_REPAIR", "FAILED_TARGET_GOVERNED_RETRY", "Systemic Defects", "Publication Contract", "Operator Workflow Gaps"]) {
      expect(report).toContain(marker);
    }
  });
});