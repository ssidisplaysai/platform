import path from "path";
import { spawnSync } from "child_process";

describe("Atlas guardrails", () => {
  const scriptPath = path.resolve(__dirname, "../../tools/atlas-guardrails/src/check.mjs");

  it("passes on the clean fixture", () => {
    const fixtureRoot = path.resolve(__dirname, "fixtures/clean");
    const result = spawnSync("node", [scriptPath, "--root", fixtureRoot], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ATLAS_GUARDRAILS_PASS");
  });

  it("fails on intentional boundary violations", () => {
    const fixtureRoot = path.resolve(__dirname, "fixtures/violation");
    const result = spawnSync("node", [scriptPath, "--root", fixtureRoot], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("ATLAS-DEP-001");
    expect(result.stdout).toContain("ATLAS-WS-001");
  });
});
