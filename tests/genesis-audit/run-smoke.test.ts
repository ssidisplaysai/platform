import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("GAR-0001 scanner smoke", () => {
  test("scanner executes and writes required artifacts", () => {
    execSync("node tools/genesis-audit/src/run.mjs", { stdio: "pipe" });
    const out = path.join(process.cwd(), "genesis", "audits", "GAR-0001");
    const required = [
      "repository-manifest.json",
      "file-inventory.json",
      "import-graph.json",
      "audit-run-manifest.json",
      "GAR-0001-Final-Report.md"
    ];
    required.forEach((name) => {
      expect(fs.existsSync(path.join(out, name))).toBe(true);
    });
  }, 600000);
});
