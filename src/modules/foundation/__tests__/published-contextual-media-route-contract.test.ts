import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/app/api/sites/[siteId]/published-contextual-media/route.ts"), "utf8");
const transportSource = readFileSync(resolve(process.cwd(), "src/modules/foundation/published-contextual-media-wordpress-transport.ts"), "utf8");

describe("published contextual media route contract", () => {
  test("requires authenticated site update authority and exact ProjectorEnclosure scope", () => {
    expect(source).toContain('authorizeRequest(request, "sites:update")');
    expect(source).toContain('siteId !== "site-ssi-projectorenclosure"');
    expect(source).toContain("isRecordInScope");
  });

  test("requires the explicit operation and does not expose cleanup controls", () => {
    expect(source).toContain("PUBLISHED_CONTEXTUAL_MEDIA_UPDATE");
    expect(source).not.toMatch(/deleteGeneratedMedia|force=true|filesystem|filePath/);
  });

  test("bounds and validates generated media transport bytes", () => {
    expect(source).toContain("MAX_GENERATED_MEDIA_BYTES = 12 * 1024 * 1024");
    expect(source).toContain("bytesBase64");
    expect(source).toContain("Generated media payload is invalid, non-canonical, or too large.");
    expect(source).toContain('bytes.toString("base64") !== body.media.bytesBase64');
  });

  test("fails media cleanup closed unless REST-visible and restricted content types are scanned", () => {
    expect(transportSource).toContain("/types?context=edit");
    expect(transportSource).toContain("wp.getPosts");
    expect(transportSource).toContain('fallback === "INCOMPLETE"');
    expect(transportSource).toContain("return [-1]");
    expect(transportSource).toContain("exactAttribute.test");
  });
});
