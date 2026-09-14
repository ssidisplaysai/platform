import fs from "node:fs";
import path from "node:path";

const publication = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wave2-publication.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-2-publication/route.ts"), "utf8");

describe("Commercial Stainless Wave 2 sequential publication contract", () => {
  test("binds exact owner operation, order, objects, hashes, and homepage baseline", () => {
    for (const marker of ["COMMERCIAL_STAINLESS_WAVE2_OWNER_AUTHORIZED_SEQUENTIAL_PUBLICATION_V1", "[12, 15, 16, 18, 19]", "b2e2f2b690e3d518472bd56e08886701293314d2215838b37d7a3c7fdbf4ddc3", "ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c", "ccac7e46d1c40239736c0c65ffe236bd4cbd62e3717cb7ddfd390cf395ef5f4f", "ceb8b68be8125545a71e17f5a6a6ecdb0148f06180555ebaf1e0b389bb9076e2", "5925c0b7c45d0b082f163c9286cb400e5ae47a35045f77cad8239f38d7206c46", "a6bbe8f0db6080c2732cb4baec7bba5d361ebacfc40a16815c655cef8f0e4508"]) expect(publication).toContain(marker);
  });

  test("requires current post content and durable exact raw authority without autosaves or reconstruction", () => {
    for (const marker of ["approvedHashDurablyStored", "!item.autosaveDependency", "sha(durable.approvedContentRaw) !== expectedHash", "sha(raw) === expectedHash", "raw === durable.approvedContentRaw", "contentReconstructed: false", "copyChanged: false", "mediaChanged: false"]) expect(publication).toContain(marker);
    expect(publication).not.toContain("/autosaves");
    expect(publication).not.toMatch(/method:\s*["']POST["']/);
  });

  test("enforces certified sequence and stop-on-first-failure", () => {
    expect(publication).toContain("WAVE2_SEQUENTIAL_STOP");
    expect(publication).toContain('receipt.status === "PUBLIC_CERTIFIED"');
    expect(route).toContain("sequentialStopTriggered: true");
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE2_NEXT_OBJECT");
  });

  test("persists two fresh actual-host convergence reads before visual certification", () => {
    for (const marker of ["convergenceReads", "FRESH_EXPECTED", "reads.length >= 2", "reads.slice(-2).every", "PUBLISHED_PENDING_VISUAL", "ACTUAL_PUBLIC_HOST_RENDER"]) expect(publication).toContain(marker);
  });

  test("requires primary presentation, responsive, contrast, media, and layout gates", () => {
    for (const marker of ["themePageTitleVisible === 0", "genesisHeroVisible === 1", "semanticH1Count === 1", "duplicatePrimaryHeadingCount === 0", "darkOnDarkFailures === 0", "lightOnLightFailures === 0", "unreadableTextFailures === 0", "brokenMedia === 0", "horizontalOverflow === 0", "largestBlankRegion <= 120"]) expect(publication).toContain(marker);
    expect(publication).toContain("media.accidentalDuplicationCount === 0");
    expect(publication).not.toContain("accidentalCompositionDuplicateMediaCount");
  });

  test("preserves Wave 1 and exposes only exact scoped commands", () => {
    expect(publication).toContain("WAVE1_PRESERVATION_GATE_FAILED");
    expect(route).toContain('authorizeRequest(request, "sites:manage_integrations")');
    expect(route).toContain("CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE2_ACTUAL_PUBLIC_RENDER");
    expect(route).toContain("wordpressContentMutation: false");
    expect(route).not.toMatch(/GLW|n8n|scheduler/i);
  });
});
