import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveGenesisContrastReadiness, normalizeGenesisRenderAuthority, selectAuthoritativeContrastEvidence } from "../../foundation/background-aware-text-contrast";
import { SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1 } from "../san-antonio-native-preview-contrast-mismatch";
import { SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE } from "../san-antonio-actual-native-contrast-evidence";

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
    expect(SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1.nativeCascadeRootCauseProven).toBe(true);
    expect(SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1.nativeWinningRuleSourceBefore).toContain("zoo-custom-style.css");
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

  test("persists actual-native before/after cascade and screenshot evidence", () => {
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.authority).toBe("ACTUAL_NATIVE_HOST_RENDER");
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.captures).toHaveLength(4);
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.captures.every((capture) => capture.failuresBefore === 9 && capture.failuresAfter === 0 && /^[a-f0-9]{64}$/.test(capture.correlationId))).toBe(true);
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.productContext.before.winningRuleSource).toContain("zoo-custom-style.css");
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.productContext.after.important).toBe(true);
    expect(SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE.screenshotComputedStyleCorrelation).toBe(true);
  });
});
