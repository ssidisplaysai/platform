jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateGlwReferenceClaimAuthority } from "../reference-claim-authority";
import { projectGlwClaimDisposition } from "../reference-claim-disposition";

const planningCases = [
  ["PRODUCT_SPECIFICATION", "Always confirm technical specifications with experts to ensure performance through Indiana's changing seasons."],
  ["WARRANTY", "Buying Criteria for Outdoor Digital Spheres in Indiana Evaluate digital spheres for: Warranty Terms and Service Support."],
  ["PRICING", "Buying Criteria for Outdoor Digital Spheres in Indiana Evaluate digital spheres for: Total Cost of Ownership (including site prep, energy, and care)."],
  ["LOCATION_FACT", "Permitting Oversight: Never begin installation before all Indiana and local municipal rules are confirmed and required permits secured."],
] as const;

const factualCases = [
  ["PRODUCT_SPECIFICATION", "This product has anti-glare performance and operates at temperature Y."],
  ["WARRANTY", "The product has a five-year warranty."],
  ["PRICING", "This product lowers operating costs."],
  ["LOCATION_FACT", "Installation in Indiana requires permit X statewide."],
] as const;

function artifact(text: string) {
  return { title: "Test", contentHtml: `<p>${text}</p>`, slug: "test", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null };
}

describe("reference retry pre-execution reconciliation", () => {
  test.each(planningCases)("treats %s confirmation guidance as non-blocking", (claimClass, text) => {
    const finding = evaluateGlwReferenceClaimAuthority({ artifact: artifact(text) }).findings.find((entry) => entry.claimClass === claimClass);
    expect(finding).toMatchObject({ authorityStatus: "APPROVED_CONCEPTUAL" });
    expect(projectGlwClaimDisposition({ claimClass, claimText: text, authorityStatus: finding?.authorityStatus })).toMatchObject({ blocking: false, disposition: "QA_FALSE_POSITIVE" });
  });

  test.each(factualCases)("keeps factual %s assertion blocked", (claimClass, text) => {
    const finding = evaluateGlwReferenceClaimAuthority({ artifact: artifact(text) }).findings.find((entry) => entry.claimClass === claimClass);
    expect(finding).toMatchObject({ authorityStatus: "UNSUPPORTED" });
    expect(projectGlwClaimDisposition({ claimClass, claimText: text, authorityStatus: finding?.authorityStatus })).toMatchObject({ blocking: true });
  });

  test("UI and QA share one disposition model", () => {
    const qa = readFileSync(join(process.cwd(), "src/modules/glw/reference-claim-authority.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8");
    expect(qa).toContain('from "./reference-claim-disposition"');
    expect(ui).toContain('from "./reference-claim-disposition"');
    expect(ui).toContain("projectGlwClaimDisposition(finding)");
  });

  test.each([
    ["CLIMATE", "Poor Weather Planning: Indiana's climate demands robust engineering—skimping on weatherproofing or durability invites costly repairs or downtime.", "REMOVE"],
    ["PRODUCT_SPECIFICATION", "Explore our Outdoor Digital Sphere solutions for additional product specifications, turnkey package details, and display options.", "REMOVE"],
    ["PRICING", "Modern digital solutions offer high-impact visuals while minimizing energy consumption, often supporting lower operational costs.", "REMOVE"],
    ["PRODUCT_SPECIFICATION", "Use anti-glare coatings or strategic placement to minimize distractions.", "REWRITE_AS_CONCEPTUAL"],
    ["DURABILITY", "Review available power sources and consult electrical contractors to install dedicated circuits.", "REWRITE_AS_CONCEPTUAL"],
  ])("projects certified %s recovery guidance", (claimClass, claimText, disposition) => {
    expect(projectGlwClaimDisposition({ claimClass, claimText, authorityStatus: "UNSUPPORTED" })).toMatchObject({ blocking: true, disposition });
  });

  test("401 gates unavailable data instead of rendering durable-looking empty values", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8").replace(/\s/g, "");
    expect(shell).toContain('sessionAvailability==="AUTHENTICATED"?children');
    expect(shell).toContain("AUTHENTICATION_REQUIRED:workspaceandcampaigndataareunavailableuntilsign-inisrestored.");
    expect(shell).toContain("Nozerooremptyvaluesshownhererepresentdurablecampaignstate.");
  });
});
