import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("GAR-0002 smoke", () => {
  test("generates required evidence and reports", () => {
    execSync("node tools/genesis-audit/src/gar-0002-run.mjs", { stdio: "pipe" });
    const evidenceDir = path.join(process.cwd(), "genesis", "audits", "GAR-0002", "evidence");
    const reportsDir = path.join(process.cwd(), "genesis", "audits", "GAR-0002", "reports");
    expect(fs.existsSync(path.join(evidenceDir, "architecture-layer-model.json"))).toBe(true);
    expect(fs.existsSync(path.join(evidenceDir, "architecture-findings.json"))).toBe(true);
    expect(fs.existsSync(path.join(evidenceDir, "gar-0002-run-manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(reportsDir, "GAR-0002-Final-Report.md"))).toBe(true);
  }, 600000);

  test("passes GAR-0002 schema validator", () => {
    const out = execSync("node tools/genesis-audit/src/gar-0002-validate.mjs", { stdio: "pipe" }).toString("utf8");
    const parsed = JSON.parse(out);
    expect(parsed.valid).toBe(true);
    expect(parsed.findingsSchemaValid).toBe(true);
  });
});
