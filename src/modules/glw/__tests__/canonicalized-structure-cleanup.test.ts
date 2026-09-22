import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanupCanonicalizedStructure } from "../canonicalized-structure-cleanup";
import { canonicalizeGlwZeroAuthorityClaims } from "../zero-authority-claim-canonicalization";

describe("canonicalized structural cleanup", () => {
  test("removes empty list items", () => {
    const input = "<h2>Why Consider</h2><ul><li></li><li>Valid item</li><li> </li></ul>";
    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.removedEmptyListItems).toBe(2);
    expect(result.html).not.toContain("<li></li>");
    expect(result.html).toContain("Valid item");
  });

  test("removes lists that have no meaningful remaining items", () => {
    const input = "<ul><li></li><li> </li></ul><p>Keep me</p>";
    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.removedEmptyLists).toBe(1);
    expect(result.html).not.toContain("<ul>");
    expect(result.html).toContain("Keep me");
  });

  test("does not allow prose replacement to remain as a table heading", () => {
    const input = [
      "<table>",
      "  <thead><tr><th>Feature</th><th>Fan Cooled Enclosures</th><th>What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?</th></tr></thead>",
      "  <tbody>",
      "    <tr><td>Cooling Method</td><td>Fan-assisted airflow</td><td>Active heating, cooling, and condensation control</td></tr>",
      "    <tr><td>Use Case</td><td>Mild environments</td><td>Harsh environments</td></tr>",
      "  </tbody>",
      "</table>",
    ].join("");

    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.removedStructuralColumns).toBeGreaterThan(0);
    expect(result.html).toContain("Fan Cooled Enclosures");
    expect(result.html).not.toContain("What environmental conditions should the project team ask");
  });

  test("removes unsupported structural comparison column without malformed rows", () => {
    const input = [
      "<table>",
      "  <thead><tr><th>Feature</th><th>Fan Cooled Enclosures</th><th>What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?</th></tr></thead>",
      "  <tbody>",
      "    <tr><td>Cooling Method</td><td>Fan-assisted airflow</td><td>Active heating</td></tr>",
      "    <tr><td>Service Access</td><td>Removable panels</td><td>Sealed access</td></tr>",
      "  </tbody>",
      "</table>",
    ].join("");

    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.html).toContain("<th>Feature</th>");
    expect(result.html).toContain("<th>Fan Cooled Enclosures</th>");
    expect(result.html).not.toContain("<th>What environmental conditions should");
    expect(result.html).toContain("<td>Cooling Method</td>");
    expect(result.html).not.toContain("<tr></tr>");
  });

  test("deduplicates adjacent identical canonical replacement questions", () => {
    const input = [
      "<ol>",
      "  <li><strong>What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?</strong></li>",
      "  <li><strong>What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?</strong></li>",
      "  <li>Select mounting method.</li>",
      "</ol>",
    ].join("");

    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.removedDuplicateCanonicalQuestions).toBe(1);
    const count = (result.html.match(/What environmental conditions should the project team ask/g) ?? []).length;
    expect(count).toBe(1);
  });

  test("preserves sentence boundaries and whitespace after transformed prompts", () => {
    const input = "<ol><li><strong>What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?</strong>Identify manufacturer installation recommendations.</li></ol>";
    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.whitespaceFixes).toBeGreaterThan(0);
    expect(result.html).toContain("installation?</strong> Identify manufacturer installation recommendations.");
    expect(result.html).not.toContain("?</strong>Identify");
  });

  test("retains supported non-structural content", () => {
    const input = "<h2>Fan Cooling Concepts: How Airflow Influences Projector Life</h2><ul><li><strong>Filtered intake fans</strong> - Fans draw ambient air through a filter material.</li></ul>";
    const result = cleanupCanonicalizedStructure({ html: input });

    expect(result.html).toContain("Fan Cooling Concepts: How Airflow Influences Projector Life");
    expect(result.html).toContain("Filtered intake fans");
  });

  test("unsupported protected claims still fail closed when canonicalization cannot safely transform", () => {
    const text = "Capability posture should be assumed project-wide.";
    const canonicalization = canonicalizeGlwZeroAuthorityClaims({
      rawArtifact: { title: "x", contentHtml: `<p>${text}</p>`, slug: "x", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null },
      authoritativeFactReferenceIds: [],
      findings: [{ claimClass: "PRODUCT_CAPABILITY", claimText: text, authoritySource: null, authorityStatus: "UNSUPPORTED", authorityKind: "UNSUPPORTED", predicateId: "unsupportedClaim.PRODUCT_CAPABILITY" }],
      fallbackPolicy: "STRICT",
    });

    expect(canonicalization.ok).toBe(false);
    expect(canonicalization.receipt.blockedClaims).toEqual([text]);
  });

  test("wordpress write paths remain draft-only", () => {
    const generationRoute = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const seoRefreshRoute = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/seo-refresh/route.ts"), "utf8");

    expect(generationRoute).toContain("writeGenesisWordPressDraft({ operation: \"UPDATE\"");
    expect(generationRoute).toContain("publicationPerformed: false");
    expect(seoRefreshRoute).toContain("operation: \"UPDATE\"");
    expect(seoRefreshRoute).toContain("publicationPerformed: false");
  });
});
