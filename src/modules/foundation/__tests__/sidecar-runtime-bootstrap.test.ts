import fs from "node:fs";
import path from "node:path";

describe("foundation sidecar runtime bootstrap", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/start-foundation-sidecar.mjs"), "utf8");
  test("loads ignored Next environment and fails closed without secure bindings", () => {
    expect(source).toContain("loadEnvConfig(process.cwd(), true)");
    expect(source).toContain('"GCP_FOUNDATION_PERSISTENCE_DIR"');
    expect(source).toContain('"GENESIS_CREDENTIAL_MASTER_KEY"');
    expect(source).not.toMatch(/console\.(?:log|error)\([^)]*process\.env\[/);
  });
});