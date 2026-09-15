import { readFileSync } from "node:fs";
import { join } from "node:path";
const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-parent-authority/route.ts"), "utf8");
describe("reference parent authority route", () => {
  test("uses distinct authority and excludes generation/publication", () => {
    expect(route).toContain("GLW_REFERENCE_PARENT_CREATION_OPERATION");
    expect(route).toContain("resolveGlwTrustedOperatorPrincipal");
    expect(route).toContain("callerSuppliedRoleHeadersAuthorize: false");
    expect(route).not.toContain("execute_workflow");
    expect(route).not.toContain("publishGenesisWordPressDraft");
    expect(route).not.toContain("issueGlwReferenceOwnerGrant");
  });
  test("rechecks inventory before consuming authority and writing once", () => {
    const initial = route.indexOf("const resolved = await live");
    const recheck = route.indexOf("const duplicateRecheck = await inspectGlwReferenceParentInventory");
    const consume = route.indexOf("consumeGlwReferenceParentCreationGrant({");
    const write = route.indexOf("writeGenesisWordPressDraft({");
    const readback = route.indexOf("const readback = await resolved.reader.getJson");
    const after = route.indexOf("const after = await inspectGlwReferenceParentInventory");
    expect(initial).toBeGreaterThan(0); expect(initial).toBeLessThan(recheck); expect(recheck).toBeLessThan(consume); expect(consume).toBeLessThan(write); expect(write).toBeLessThan(readback); expect(readback).toBeLessThan(after);
    expect(route.match(/writeGenesisWordPressDraft\(\{/g)).toHaveLength(1);
    expect(route).toContain('operation: "CREATE"');
    expect(route).toContain('status: "draft"');
    expect(route).toContain("contentCertificationRequired: true");
  });
});
