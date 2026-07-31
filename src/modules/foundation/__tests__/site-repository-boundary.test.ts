import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("site repository boundary", () => {
  test("marks site repository as server-only", () => {
    const path = resolve(process.cwd(), "src/modules/foundation/site-repository.ts");
    const source = readFileSync(path, "utf8");

    expect(source).toContain('import "server-only";');
  });

  test("context no longer imports filesystem-backed site repository", () => {
    const path = resolve(process.cwd(), "src/modules/foundation/context.ts");
    const source = readFileSync(path, "utf8");

    expect(source).toContain('from "./site-context-source"');
    expect(source).not.toContain('from "./site-repository"');
  });
});
