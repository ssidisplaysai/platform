import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveGenesisContrastReadiness, normalizeGenesisRenderAuthority, selectAuthoritativeContrastEvidence } from "../../foundation/background-aware-text-contrast";
import { SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1 } from "../san-antonio-native-preview-contrast-mismatch";

const snapshot = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/native-wordpress-render-snapshot/route.ts"), "utf8");
const browser = readFileSync(join(process.cwd(), "src/modules/foundation/governed-render-capture-browser.ts"), "utf8");
const adapter = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-background-aware-contrast-service.ts"), "utf8");

describe("native host render contrast authority", () => {
  test("classifies the synthetic shell below actual native preview", () => {
    expect(adapter).toContain('authority: "HOST_EQUIVALENT_RENDER"');
    expect(normalizeGenesisRenderAuthority("HOST_RENDER")).toBe("HOST_EQUIVALENT_RENDER");
    const equivalent = { authority: "HOST_EQUIVALENT_RENDER" as const, state: "PASS" as const };
    const native = { authority: "ACTUAL_NATIVE_HOST_RENDER" as const, state: "FAIL" as const };
    expect(selectAuthoritativeContrastEvidence([equivalent, native])).toBe(native);
  });

  test("blocks readiness for the owner-observed native contradiction", () => {
    expect(SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1.state).toBe("FAIL");
    expect(SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1.nativeCascadeRootCauseProven).toBe(false);
    expect(deriveGenesisContrastReadiness({ state: "PASS", authority: "HOST_EQUIVALENT_RENDER", nativeHostEvidenceAvailable: true, higherAuthorityContradiction: true })).toMatchObject({ ownerReviewReady: false, publicationReady: false });
  });

  test("records why the snapshot is not a native preview request", () => {
    expect(snapshot).toContain('fetch("https://projectorenclosure.com/fan-cooled-projector-enclosures/"');
    expect(snapshot).toContain('data-native-wordpress-equivalent="13103"');
    expect(snapshot).not.toMatch(/preview_nonce|preview_id|preview=true|wordpress_logged_in/);
  });

  test("requires stable styles and correlates screenshot with computed evidence", () => {
    expect(browser).toContain("stableSamples < 3");
    expect(browser).toContain('link[rel="stylesheet"]');
    expect(browser).toContain("screenshotComputedStyleCorrelationId");
    expect(browser).toContain("styleSettlement.signature");
    expect(browser).toContain("matchedColorDeclarations");
    expect(browser).toContain("winningColorDeclaration");
  });
});
