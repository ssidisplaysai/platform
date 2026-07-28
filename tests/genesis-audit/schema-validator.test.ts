import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function runValidator(expression: string) {
  const cmd = `node --input-type=module -e "import('./tools/genesis-audit/src/schema-validator.mjs').then((m)=>{const v=${expression};process.stdout.write(JSON.stringify(v));})"`;
  const out = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  return JSON.parse(out);
}

describe("schema validator", () => {
  test("envelope validation", () => {
    const ok = runValidator("m.validateSchemaEnvelope({schemaIdentifier:'x',schemaVersion:'1',scannerVersion:'1',evidenceClassification:'VERIFIED',generationMethod:'deterministic',limitations:[]})");
    expect(ok.valid).toBe(true);
  });

  test("output validation detects missing envelope keys", () => {
    const temp = path.join(process.cwd(), ".tmp-genesis-audit-test");
    fs.mkdirSync(temp, { recursive: true });
    fs.writeFileSync(path.join(temp, "bad.json"), JSON.stringify({ a: 1 }), "utf8");
    const r = runValidator(`m.validateOutputs('${temp.replace(/\\/g, "\\\\")}')`);
    expect(r.valid).toBe(false);
    fs.rmSync(temp, { recursive: true, force: true });
  });
});
