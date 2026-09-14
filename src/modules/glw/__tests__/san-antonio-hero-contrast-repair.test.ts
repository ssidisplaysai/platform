import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-hero-contrast-repair.ts"), "utf8");

describe("San Antonio hero contrast repair", () => {
  test("is locked to object 13103 native-repair hash and changes only scoped hero colors", () => { expect(source).toContain("98310d967361e3db57c18a782cbe2340e46552f73a9624a8f182b4c6055b2128"); expect(source).toContain("body.page-id-13103 .saw-hero h1"); expect(source).toContain("color:#fff!important"); expect(source).not.toMatch(/background-image\s*:|url\(/); });
  test("preserves approved eyebrow, CTA, supporting-copy, and disclaimer treatments", () => { for (const value of ["#f2b84b", "#172022", "#f5f7f7", "border-color:#fff", "#d7dddd"]) expect(source).toContain(value); });
  test("contains no generation, media replacement, dispatch, workflow, or publication path", () => { expect(source).not.toMatch(/generate|featured_media|dispatch|workflow|publish/i); });
});