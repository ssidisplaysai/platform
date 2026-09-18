import { readFileSync } from "node:fs";
import { join } from "node:path";

const browser = readFileSync(join(process.cwd(), "src/modules/foundation/governed-render-capture-browser.ts"), "utf8");

describe("governed render capture css background readiness", () => {
  test("keeps existing DOM image settlement and adds assignment-aware settle input", () => {
    expect(browser).toContain("async function settle(page: Page, mediaAssignments: readonly CaptureMediaAssignment[])");
    expect(browser).toContain("const images = Array.from(document.images)");
    expect(browser).toContain("await bounded(Promise.all(images));");
  });

  test("waits for css background resources via in-browser Image load and decode", () => {
    expect(browser).toContain("backgroundAssignments");
    expect(browser).toContain("cssBackgroundUrls");
    expect(browser).toContain("const image = new Image();");
    expect(browser).toContain("if (typeof image.decode === \"function\")");
    expect(browser).toContain("await image.decode();");
    expect(browser).toContain("requestAnimationFrame(() => requestAnimationFrame(resolve))");
  });

  test("includes rich hero background in stable settlement signature", () => {
    expect(browser).toContain("const heroSelector = \".glw-sphere-hero[data-genesis-hero=\\\"true\\\"][data-media-role=\\\"CONTEXTUAL_IN_USE\\\"]\";");
    expect(browser).toContain("const heroSignature = (() =>");
    expect(browser).toContain("style.backgroundImage");
    expect(browser).toContain("style.backgroundSize");
    expect(browser).toContain("style.backgroundPosition");
  });

  test("fails closed when assigned contextual background is not ready", () => {
    expect(browser).toContain("CAPTURE_ASSIGNED_BACKGROUND_NOT_READY");
    expect(browser).toContain("expectedContextualBackground");
    expect(browser).toContain("hasAssignedBackground");
  });

  test("calls settle with media assignments before geometry and screenshot", () => {
    expect(browser).toContain("const styleSettlement = await settle(page, input.mediaAssignments);");
    const settleIndex = browser.indexOf("const styleSettlement = await settle(page, input.mediaAssignments);");
    const geometryIndex = browser.indexOf("measured = await geometry(page, input.mediaAssignments);");
    const screenshotIndex = browser.indexOf("const bytes = await page.screenshot");
    expect(settleIndex).toBeGreaterThan(-1);
    expect(geometryIndex).toBeGreaterThan(settleIndex);
    expect(screenshotIndex).toBeGreaterThan(geometryIndex);
  });

  test("preserves saw/non-background signature selectors", () => {
    expect(browser).toContain(".saw-hero h1");
    expect(browser).toContain("#contextual-in-use h2");
    expect(browser).toContain(".saw-cta h2");
    expect(browser).toContain(".saw-cta .saw-kicker");
  });
});
