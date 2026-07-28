import { execSync } from "child_process";

function runUtils(expression: string) {
  const cmd = `node --input-type=module -e "import('./tools/genesis-audit/src/utils.mjs').then((m)=>{const v=${expression};process.stdout.write(JSON.stringify(v));})"`;
  const out = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  return JSON.parse(out);
}

describe("genesis-audit utils", () => {
  test("path normalization", () => {
    expect(runUtils("m.normalizePath('a\\\\b\\\\c.ts')")).toBe("a/b/c.ts");
  });

  test("deterministic stable stringify", () => {
    const left = runUtils("m.stableStringify({ b:1, a:{ d:1, c:2 } })");
    const right = runUtils("m.stableStringify({ a:{ c:2, d:1 }, b:1 })");
    expect(left).toBe(right);
  });

  test("deterministic hashing", () => {
    const x = runUtils("m.sha256Text('hello')");
    const y = runUtils("m.sha256Text('hello')");
    expect(x).toBe(y);
  });

  test("file classification and flags", () => {
    expect(runUtils("m.fileCategoryFromExtension('.ts')")).toBe("source");
    const flags = runUtils("m.booleanFlagsForPath('src/app/a.test.ts','source')");
    expect(flags.isSource).toBe(true);
    expect(flags.isTest).toBe(true);
  });
});
