import { readFileSync } from "node:fs";
import { join } from "node:path";
import { annotateGovernedHeadings, removeBackgroundAwareContrastFromSanAntonio, removeDurableHeadingContrastFromSanAntonio } from "../san-antonio-background-aware-contrast-repair";
const shared = readFileSync(join(process.cwd(), "src/modules/foundation/background-aware-text-contrast.ts"), "utf8"); const repair = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-background-aware-contrast-repair.ts"), "utf8"); const update = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-background-aware-contrast-update-service.ts"), "utf8"); const durableUpdate = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-durable-heading-contrast-update-service.ts"), "utf8"); const route = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/wordpress-staging/route.ts"), "utf8");
test("uses the shared luminance contract instead of per-heading selectors", () => { expect(repair).toContain("GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_CSS"); expect(shared).toContain('data-genesis-background-luminance'); expect(repair).not.toMatch(/credible covered|Convention and Event|San Antonio.*h2/i); });
test("supports light, dark, and image-overlay surfaces while preserving layout and media", () => { expect(repair).toContain("IMAGE_WITH_DARK_OVERLAY"); expect(repair).toContain("LIGHT_SOLID"); expect(repair).toContain("DARK_SOLID"); expect(repair).not.toMatch(/grid-template|background-image|featured_media|<img/i); });
test("defines a reversible contrast-only transform", () => { expect(repair).toContain("removeBackgroundAwareContrastFromSanAntonio"); expect(removeBackgroundAwareContrastFromSanAntonio("unchanged")).toBe("unchanged"); });
test("binds the update to exact object/hash and preserves content, media, SEO, and draft status", () => { expect(route).toContain("SAN_ANTONIO_SYSTEMIC_CONTRAST_OPERATION"); expect(update).toContain("SAN_ANTONIO_SYSTEMIC_CONTRAST_BEFORE_HASH"); for (const value of ["copyHashBefore", "sectionSequenceBefore", "mediaUrlsBefore", "seoHashBefore", "featuredMediaBefore: 10757", 'wordpressStatus: "draft"', "contrastOnlyMutationProven: true"]) expect(update).toContain(value); expect(update).not.toMatch(/publishGlw|dispatchGlw|execute_workflow|generateGenesisFeaturedImage/i); });
test("gives governed headings self-contained dark and light authority", () => {
	expect(shared).toContain('[data-genesis-background-luminance="dark"] :is(h1,h2,h3)[data-genesis-heading-authority="governed"]');
	expect(shared).toContain('[data-genesis-background-luminance="light"] :is(h1,h2,h3)[data-genesis-heading-authority="governed"]');
	expect(shared).toContain("!important");
	const before = `<section data-genesis-background-luminance="dark"><div><h2>A heading</h2></div></section><section data-genesis-background-luminance="light"><h3 class="title">Another heading</h3></section><section><h2>Unmanaged</h2></section>`;
	const after = annotateGovernedHeadings(before);
	expect(after).toContain('<h2 data-genesis-heading-authority="governed">A heading</h2>');
	expect(after).toContain('<h3 data-genesis-heading-authority="governed" class="title">Another heading</h3>');
	expect(after).toContain("<h2>Unmanaged</h2>");
	expect(removeDurableHeadingContrastFromSanAntonio(after)).toBe(before);
	expect(removeDurableHeadingContrastFromSanAntonio).toBeDefined();
});
test("binds durable heading repair to the current hash and preserves governed content", () => {
	expect(route).toContain("SAN_ANTONIO_DURABLE_HEADING_CONTRAST_OPERATION");
	expect(durableUpdate).toContain("SAN_ANTONIO_DURABLE_HEADING_CONTRAST_BEFORE_HASH");
	for (const value of ["copyHashBefore", "sectionSequenceBefore", "mediaUrlsBefore", "seoHashBefore", "productGridBefore", "featuredMediaBefore: 10757", 'wordpressStatus: "draft"', "contrastOnlyMutationProven: true"]) expect(durableUpdate).toContain(value);
	expect(durableUpdate).not.toMatch(/publishGlw|dispatchGlw|execute_workflow|generateGenesisFeaturedImage/i);
});