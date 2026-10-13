import { evaluateGlwStateLocalizationContamination, GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION } from "../state-localization-contamination";
import { evaluateGlwGeneratedContentQa } from "../generated-content-qa";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function evaluate(contentHtml: string, authorizedComparisonStateCodes: readonly string[] = []) {
  return evaluateGlwStateLocalizationContamination({ contentHtml, expectedStateCode: "IN", authorizedComparisonStateCodes });
}

describe("GLW state localization contamination", () => {
  test("passes an Indiana-only conceptual page", () => {
    expect(evaluate("<h1>Outdoor Digital Sphere in Indiana</h1><p>Indiana organizations may evaluate a sphere as a possible event application.</p>")).toMatchObject({ ok: true, expectedStatePresent: true, contaminations: [] });
  });

  test.each([
    ["Illinois", "IL"],
    ["Texas", "TX"],
    ["California", "CA"],
  ])("blocks factual %s target-context contamination", (stateName, stateCode) => {
    const result = evaluate(`<h1>Outdoor Digital Sphere in Indiana</h1><p>Our installations across ${stateName} serve local venues.</p>`);
    expect(result).toMatchObject({ ok: false, expectedStatePresent: true, contaminations: [expect.objectContaining({ stateCode })] });
  });

  test("ignores another state in navigation links", () => {
    expect(evaluate('<h1>Outdoor Digital Sphere in Indiana</h1><nav><a href="/illinois/">Illinois</a></nav>')).toMatchObject({ ok: true, contaminations: [] });
  });

  test("allows an explicitly authorized comparison", () => {
    expect(evaluate("<h1>Outdoor Digital Sphere in Indiana</h1><p>Compared with Illinois, Indiana organizations may evaluate different event contexts.</p>", ["IL"])).toMatchObject({ ok: true, contaminations: [] });
  });

  test("requires expected state identity", () => {
    expect(evaluate("<h1>Outdoor Digital Sphere planning guide</h1>")).toMatchObject({ ok: false, expectedStatePresent: false });
  });

  test("covers non-target states through the complete U.S. state authority", () => {
    const result = evaluate("<h1>Outdoor Digital Sphere in Indiana</h1><p>Serving Alabama businesses with local installations.</p><p>Across Wyoming, venues use this display.</p>");
    expect(result.contaminations.map((entry) => entry.stateCode)).toEqual(["AL", "WY"]);
    expect(result.policyVersion).toBe(GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION);
  });

  test("all blocking QA stages precede WordPress draft mutation", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const productQa = route.indexOf("productAuthorityFailures");
    const claimQa = route.indexOf("claimAuthority && !claimAuthority.ok");
    const localizationQa = route.indexOf("localizationFailures");
    const remainingQa = route.indexOf("if (!qa.ok)");
    const wordpressWrite = route.indexOf("writeGenesisWordPressDraft({ operation:");
    expect(productQa).toBeGreaterThan(0);
    expect(productQa).toBeLessThan(claimQa);
    expect(claimQa).toBeLessThan(localizationQa);
    expect(localizationQa).toBeLessThan(remainingQa);
    expect(remainingQa).toBeLessThan(wordpressWrite);
  });

  test("generated-content QA blocks contamination before WordPress", () => {
    const qa = evaluateGlwGeneratedContentQa({
      artifact: { title: "Outdoor Digital Sphere in Indiana", contentHtml: "<h1>Outdoor Digital Sphere in Indiana</h1><p>Our installations across Illinois serve local venues.</p>", slug: "outdoor-digital-sphere/indiana", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null },
      request: { pageType: "state_service", stateCode: "IN", stateName: "Indiana", cityName: null, productTopic: "Outdoor Digital Sphere", canonicalPath: "outdoor-digital-sphere/indiana" } as never,
      siteDomain: "leddisplaywarehouse.com",
      minimumWordCount: 1,
    });
    expect(qa.checks.stateLocalizationContamination).toMatchObject({ ok: false });
    expect(qa.ok).toBe(false);
  });
});
