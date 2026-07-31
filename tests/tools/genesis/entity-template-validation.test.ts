import { describe, expect, it } from "@jest/globals";
import { execFileSync } from "node:child_process";

describe("entity template validation", () => {
  it("validates template catalog and renders type-safe fixtures", async () => {
    const output = execFileSync("node", ["tools/genesis/templates/entity/validate-templates.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(output).toContain("Template validation passed.");
    expect(output).toContain("service.template.ts");
    expect(output).toContain("validator.template.ts");
  });
});
