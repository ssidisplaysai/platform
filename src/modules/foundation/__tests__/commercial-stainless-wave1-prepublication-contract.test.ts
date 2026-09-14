import fs from "node:fs";
import path from "node:path";

const staging = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wordpress-staging.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-1-prepublication/route.ts"), "utf8");

describe("Commercial Stainless Wave 1 prepublication contract", () => {
  test("rechecks exactly five preserved autosaves read-only", () => {
    for (const pair of ["[24, 88]", "[11, 89]", "[13, 90]", "[17, 91]", "[23, 92]"]) expect(staging).toContain(pair);
    for (const marker of ["contentIdentity", "renderedIdentity", "seoPreserved", "canonicalPreserved", "indexabilityPreserved", "mediaValid", "linksValid", "compositionValid", "responsiveValid"]) expect(staging).toContain(marker);
    expect(route).toContain("mutationPerformed: false");
    expect(route).not.toMatch(/export async function POST|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  });

  test("uses PREPUBLICATION_READY and never claims native or public certification", () => {
    expect(staging).toContain('"PREPUBLICATION_READY"');
    expect(route).toContain("nativePreviewAvailable: false");
    expect(route).not.toMatch(/NATIVE_WORDPRESS_PREVIEW_CERTIFIED|PUBLIC_CERTIFIED/);
  });
});