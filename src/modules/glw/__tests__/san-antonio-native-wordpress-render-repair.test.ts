import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateSanAntonioNativeRepairContract } from "../san-antonio-native-wordpress-render-repair";

const source = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-native-wordpress-render-repair.ts"), "utf8");
const snapshot = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/native-wordpress-render-snapshot/route.ts"), "utf8");
const capture = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-native-wordpress-render-capture-service.ts"), "utf8");

describe("San Antonio native WordPress rich-composition contract", () => {
  test("suppresses only page 13103 theme title and featured-media presentation", () => { expect(source).toContain("body.page-id-13103 .page-title.the-title"); expect(source).toContain("body.page-id-13103 .post-media.single-image"); expect(source).toContain("display:none!important"); expect(source).not.toMatch(/featured_media\s*:\s*(?:0|null)/); });
  test("repairs min-content geometry without global word-break overrides", () => { expect(source).toContain("minmax(0,1.1fr) minmax(22rem,.9fr)"); expect(source).toContain("minmax(0,1fr)"); expect(source).toContain("min-width:0"); expect(source).toContain("word-break:normal"); expect(source).toContain("hyphens:none"); expect(source).not.toContain("word-break:none"); });
  test("declares ownership and stable measurement sections", () => { const contract = evaluateSanAntonioNativeRepairContract(source); expect(source).toContain("GENESIS_OWNS_PRIMARY_PAGE_PRESENTATION_V1"); expect(source).toContain('id="product-authority"'); expect(source).toContain('id="contextual-in-use"'); expect(contract.state).toBe("FAIL"); });
  test("uses a signed live-shell snapshot and does not claim native preview certification", () => { expect(snapshot).toContain("verifyGovernedSnapshotPath"); expect(snapshot).toContain("header#cafe-site-header"); expect(snapshot).toContain("footer#cafe-site-footer"); expect(snapshot).toContain("page-title the-title"); expect(snapshot).toContain("post-media single-image"); expect(capture).toContain("nativePreviewAutomationAvailable: false"); expect(capture).toContain("nativePreviewCertificationClaimed: false"); });
  test("measures responsive split, aspect ratio, and per-word fragmentation", () => { expect(capture).toContain("productImageAspectRatio"); expect(capture).toContain("productHeadingMaxWordFragments"); expect(capture).toContain("contextualHeadingMaxWordFragments"); expect(capture).toContain("productMediaRatio < .5"); expect(capture).toContain("horizontalOverflow !== 0"); });
});