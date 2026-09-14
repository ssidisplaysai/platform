jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalizeGlwSiteHost, glwSiteHostsMatch } from "../site-identity";
import { resolveGlwAllowedInternalLinks } from "../site-internal-link-authority";
import { evaluateGlwReferenceClaimAuthority, GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";

describe("GLW reference generation grounding hardening", () => {
  test.each([
    "LEDDisplayWarehouse.com",
    "leddisplaywarehouse.com",
    "https://leddisplaywarehouse.com",
    "https://LEDDisplayWarehouse.com/",
    "https://www.leddisplaywarehouse.com/",
  ])("canonicalizes configured site identity %s", (value) => {
    expect(canonicalizeGlwSiteHost(value)).toBe("leddisplaywarehouse.com");
    expect(glwSiteHostsMatch(value, "leddisplaywarehouse.com")).toBe(true);
  });

  test("does not leak authority across sites", () => {
    expect(glwSiteHostsMatch("leddisplaywarehouse.com.evil.test", "leddisplaywarehouse.com")).toBe(false);
    expect(glwSiteHostsMatch("other.test", "leddisplaywarehouse.com")).toBe(false);
  });

  test("resolves only the governed outdoor product authority", () => {
    const base = { organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", stateCode: "IN", canonicalPath: "/outdoor-digital-sphere/indiana/" };
    expect(resolveGlwAllowedInternalLinks(base)).toEqual([{ href: "/outdoor-digital-sphere/", anchorText: "Outdoor Digital Sphere", authorityClass: "product" }]);
    expect(resolveGlwAllowedInternalLinks({ ...base, siteId: "site-other" })).toEqual([]);
  });

  test("versioned claim policy blocks forensic unsupported claims", () => {
    const artifact = {
      title: "Outdoor Digital Sphere in Illinois",
      contentHtml: "<p>Illinois venues continue to adopt immersive visual formats.</p><p>Weatherproof Construction materials withstand moisture and UV exposure.</p><p>Select brightness ratings for local lighting conditions. Many digital spheres support interactivity through motion sensors and mobile apps, with remote diagnostics, local installation assistance, training, timely service response, and warranty availability.</p>",
      slug: "outdoor-digital-sphere/illinois", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null,
    };
    const result = evaluateGlwReferenceClaimAuthority({ artifact });
    expect(result.policyVersion).toBe(GLW_REFERENCE_QA_POLICY_VERSION);
    expect(result.ok).toBe(false);
    expect(new Set(result.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").map((finding) => finding.claimClass))).toEqual(expect.objectContaining(new Set(["MARKET_ADOPTION", "DURABILITY", "BRIGHTNESS", "INTERACTIVITY", "REMOTE_MANAGEMENT", "INSTALLATION_SERVICE", "TRAINING", "SERVICE_AVAILABILITY", "WARRANTY"])));
  });

  test("source code contains no fuzzy domain fallback", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/site-identity.ts"), "utf8");
    expect(source).not.toMatch(/includes\(|endsWith\(/);
  });
});