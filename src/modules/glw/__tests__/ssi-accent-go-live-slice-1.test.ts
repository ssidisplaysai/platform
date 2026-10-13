jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SSI_ACCENT_CANONICAL_URL,
  SSI_ACCENT_PRODUCT_ID,
  SSI_ACCENT_SITE_ID,
  normalizeSsiAccentProductAuthority,
} from "@/modules/foundation/ssi-accent-product-authority";
import type { ProductConfiguration, SiteConfiguration } from "@/modules/foundation/types";
import { evaluateGlwReferenceClaimAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";
import { createGlwReferenceContentReconciliationReceipt } from "../reference-content-reconciliation";
import { resolveGlwAllowedInternalLinks } from "../site-internal-link-authority";

function artifact(contentHtml: string) {
  return { title: "California", contentHtml, slug: "accent-rear-projection-film/california", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null };
}

describe("SSI Accent go-live slice 1", () => {
  test("classifies negated, conditional, interrogative, cited, and procurement language as conceptual", () => {
    const result = evaluateGlwReferenceClaimAuthority({ artifact: artifact([
      "<p>Do not assume a product specification without approved documentation.</p>",
      "<p>If touch or another interactive layer is being considered, treat it as a separate review.</p>",
      "<p>What warranty terms can be confirmed in writing?</p>",
      "<p>Consult the National Weather Service for official climate information.</p>",
      "<p>Before requesting pricing, assemble verified project facts.</p>",
      "<p>The same rule applies to warranties and service availability.</p>",
    ].join("")) });
    expect(result.policyVersion).toBe(GLW_REFERENCE_QA_POLICY_VERSION);
    expect(result.ok).toBe(true);
    expect(result.findings.every((finding) => finding.authorityStatus === "APPROVED_CONCEPTUAL")).toBe(true);
  });

  test.each([
    ["BRIGHTNESS", "<p>Accent film has a brightness rating of 500 nits.</p>"],
    ["WARRANTY", "<p>Every Accent film order includes a ten-year warranty.</p>"],
    ["PRICING", "<p>Accent film costs $100 per square foot.</p>"],
    ["CLIMATE", "<p>California climate conditions require this film configuration.</p>"],
    ["INTERACTIVITY", "<p>Accent film supports interactive touch applications.</p>"],
  ])("continues to block genuine affirmative %s claims", (claimClass, html) => {
    const result = evaluateGlwReferenceClaimAuthority({ artifact: artifact(html) });
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([expect.objectContaining({ claimClass, authorityStatus: "UNSUPPORTED" })]);
  });

  test("normalizes only exact SSI Accent authority from verified page 6285 facts", () => {
    const product = {
      productId: SSI_ACCENT_PRODUCT_ID,
      organizationId: "ssi",
      productName: "Accent Rear Projection Film",
      sourceEvidenceReference: "legacy",
      specifications: [],
    } as unknown as ProductConfiguration;
    const normalized = normalizeSsiAccentProductAuthority({
      site: { organizationId: "ssi", siteId: SSI_ACCENT_SITE_ID } as SiteConfiguration,
      product,
    });
    expect(normalized.sourceEvidenceReference).toBe(`wordpress-page:6285:${SSI_ACCENT_CANONICAL_URL}`);
    expect(normalized.specifications.map((item) => item.rawValue)).toEqual(["Frosted White", "79%", "175 degrees"]);
    expect(normalizeSsiAccentProductAuthority({ site: { organizationId: "ssi", siteId: "other" } as SiteConfiguration, product })).toBe(product);
  });

  test("resolves the exact canonical Accent product link without cross-site leakage", () => {
    const request = { organizationId: "ssi", siteId: SSI_ACCENT_SITE_ID, productId: SSI_ACCENT_PRODUCT_ID, stateCode: "CA", canonicalPath: "/accent-rear-projection-film/california/" };
    expect(resolveGlwAllowedInternalLinks(request)).toEqual([{ href: SSI_ACCENT_CANONICAL_URL, anchorText: "Accent Rear Projection Film", authorityClass: "product" }]);
    expect(resolveGlwAllowedInternalLinks({ ...request, siteId: "other" })).toEqual([]);
  });

  test("certifies exact hash-bound markup-only reconciliation and rejects material drift", () => {
    const artifactHtml = "<h1>Accent</h1><p>California planning.</p>";
    const storedContentHtml = "<div><h1>Accent</h1><p>California planning.</p></div>";
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    expect(createGlwReferenceContentReconciliationReceipt({
      organizationId: "ssi", siteId: SSI_ACCENT_SITE_ID, campaignId: "campaign", stateCode: "CA",
      jobId: "job", wordpressObjectId: "15336", artifactHtml, storedContentHtml,
      expectedArtifactSha256: hash(artifactHtml), expectedStoredContentSha256: hash(storedContentHtml),
      mediaAuthority: "UNGOVERNED", hostCertification: "PENDING", qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    })).toMatchObject({ relationship: "MARKUP_ONLY", materialContentChanged: false });
    expect(() => createGlwReferenceContentReconciliationReceipt({
      organizationId: "ssi", siteId: SSI_ACCENT_SITE_ID, campaignId: "campaign", stateCode: "CA",
      jobId: "job", wordpressObjectId: "15336", artifactHtml, storedContentHtml: "<p>Changed claim.</p>",
      expectedArtifactSha256: hash(artifactHtml), expectedStoredContentSha256: hash("<p>Changed claim.</p>"),
      mediaAuthority: "UNGOVERNED", hostCertification: "PENDING", qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    })).toThrow("REFERENCE_MATERIAL_CONTENT_DRIFT");
  });

  test("commits the exact California reconciliation receipt without claiming media or host authority", () => {
    const receipt = JSON.parse(readFileSync(join(process.cwd(), "docs/genesis/evidence/ssi-accent-ca-reference-reconciliation-v1.json"), "utf8"));
    expect(receipt).toMatchObject({
      wordpressObjectId: "15336",
      artifactSha256: "57a51b2c69d53b38767e0d67997e03b1fb25e7974904a50647634093e8c950c7",
      storedContentSha256: "07257007767297c0a3e3e49943fef45b796538a5786aa5ab101f42648c201872",
      relationship: "MARKUP_ONLY",
      materialContentChanged: false,
      mediaAuthority: "UNGOVERNED",
      hostCertification: "PENDING",
      qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    });
    const { receiptFingerprint, ...semantic } = receipt;
    expect(createHash("sha256").update(JSON.stringify(semantic)).digest("hex")).toBe(receiptFingerprint);
  });
});