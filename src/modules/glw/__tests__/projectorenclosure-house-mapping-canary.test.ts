jest.mock("server-only", () => ({}));

import { applyProjectorEnclosureHouseMappingCanary } from "../projectorenclosure-house-mapping-canary";
import type { GlwGeneratedContentArtifact } from "../page-execution";
import type { GlwGenerationRequest } from "../page-generation";

const request = {
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-homeline-projector-enclosure",
  pageType: "general_service",
  canonicalPath: "house-projection-mapping-enclosure",
} as GlwGenerationRequest;
const artifact = {
  title: "Generated",
  contentHtml: "<p>Generated body</p>",
  slug: "generated",
  excerpt: "Generated excerpt",
  seoTitle: "Generated SEO",
  metaDescription: "Generated meta",
  focusKeyphrase: "generated focus",
} as GlwGeneratedContentArtifact;

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("ProjectorEnclosure house mapping canary policy", () => {
  const result = applyProjectorEnclosureHouseMappingCanary({ request, artifact });

  test("applies only to the exact ProjectorEnclosure Homeline canary target", () => {
    expect(result).not.toBe(artifact);
    expect(applyProjectorEnclosureHouseMappingCanary({ request: { ...request, canonicalPath: "other" }, artifact })).toBe(artifact);
    expect(result).toMatchObject({
      title: "Projector Enclosure for House Projection Mapping",
      slug: "house-projection-mapping-enclosure",
      focusKeyphrase: "projector enclosure for house projection mapping",
    });
  });

  test("meets bounded content length and required ownership architecture", () => {
    const text = plainText(result.contentHtml);
    const wordCount = text.split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(1500);
    expect(wordCount).toBeLessThanOrEqual(2200);
    for (const phrase of [
      "house projection mapping enclosure",
      "Halloween, Christmas, and Seasonal House Mapping",
      "Projection Mapping Software",
      "When Homeline Is Not the Right Enclosure",
      "Planning a House Projection Mapping Setup",
    ]) expect(result.contentHtml).toContain(phrase);
  });

  test("uses exact required internal links and no placeholders or tracking", () => {
    expect(result.contentHtml).toContain('href="https://projectorenclosure.com/homeline-projector-enclosure/"');
    expect(result.contentHtml).toContain('href="https://projectorenclosure.com/fan-cooled-projector-enclosure-holiday-projection-mapping/"');
    expect(result.contentHtml).not.toMatch(/utm_|href=["']#|house-projection-mapping-enclosure["']/i);
  });

  test("contains all verified Homeline facts and compatibility checks", () => {
    for (const phrase of [
      "steel enclosure body", "49 lb", "23.66 x 22.60 x 10.83 in", "under 7.5 in high",
      "under 16 in deep", "20 in wide or less", "temperature-controlled fan cooling",
      "wired cord", "internal outlet", "internal breaker", "one year", "lens position",
      "intake and exhaust", "cable routing", "required clearance",
    ]) expect(result.contentHtml.toLowerCase()).toContain(phrase.toLowerCase());
  });

  test("keeps software neutral and excludes unsupported claims", () => {
    for (const product of ["HeavyM", "MadMapper", "Resolume Arena", "TouchDesigner"]) expect(result.contentHtml).toContain(product);
    for (const prohibited of [
      /\bIP rating\b/i, /\bdirect rain\b/i, /\bdirect snow\b/i, /\bunattended\b/i,
      /\boperating temperature range\b/i, /\bvoltage\b/i, /\buniversal compatibility\b/i,
      /\blocks?\b/i, /\bsecurity\b/i, /\bservice panel\b/i, /\bright-side-lens\b/i,
      /\bHDMI\b/i, /\bpartnership\b/i, /\bcertified compatibility\b/i,
    ]) expect(result.contentHtml).not.toMatch(prohibited);
  });
});
