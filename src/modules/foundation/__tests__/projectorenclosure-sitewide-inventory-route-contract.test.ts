import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ProjectorEnclosure sitewide inventory route contract", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/api/sites/[siteId]/sitewide-inventory/route.ts"), "utf8");
  const service = readFileSync(resolve(process.cwd(), "src/modules/foundation/projectorenclosure-sitewide-inventory-service.ts"), "utf8");

  test("requires authenticated ProjectorEnclosure scope and explicit read-only operation", () => {
    expect(source).toContain('authorizeRequest(request, "sites:manage_integrations")');
    expect(source).toContain('siteId !== "site-ssi-projectorenclosure"');
    expect(source).toContain('body?.operation !== "BUILD_READ_ONLY_SITEWIDE_INVENTORY"');
  });

  test("collector has no WordPress write methods and fixes all mutation counters at zero", () => {
    expect(service).toContain("<methodName>wp.getPost</methodName>");
    expect(service).not.toContain("<methodName>wp.editPost</methodName>");
    expect(service).not.toMatch(/method:\s*["'](?:PUT|PATCH|DELETE)["']/);
    expect(service).not.toContain("writePublishedPageContent");
    expect(service).not.toContain("uploadGeneratedMedia");
    expect(service).not.toContain("deleteGeneratedMedia");
    expect(service).toContain("mutationCounters: { wordpress: 0, media: 0, redirects: 0, yoast: 0, products: 0 }");
  });
});