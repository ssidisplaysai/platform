import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-608895-reconciliation.ts"), "utf8");
const route = readFileSync(join(process.cwd(), "src/app/api/glw/incidents/san-antonio-608895/reconcile/route.ts"), "utf8");

describe("San Antonio 608895 owner-authorized reconciliation boundary", () => {
  test("binds the exact incident and preserves its classification", () => {
    for (const value of ["608895", "f518ffb7-9216-4866-a93c-7f4793e74038", "aaba3a04-4f7a-493e-8893-a8a1769a4ec7", "UNAUTHORIZED_VALID_DISPATCH", "a478108f81ea0a49027d968cb62e979bc453c68b", "0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2"]) expect(service).toContain(value);
  });

  test("requires exact owner confirmation, principal, scope, role, and identifiers", () => {
    expect(route).toContain("platform_admin");
    expect(route).toContain("resolveRequestPrincipal(request)");
    expect(route).toContain("resolveRequestScope(request)");
    expect(route).toContain("SAN_ANTONIO_608895_OWNER_AUTHORIZED_RECONCILIATION_V1");
    for (const field of ["campaignId", "targetId", "jobId", "leaseId", "externalExecutionId"]) expect(route).toContain(`body.${field}`);
  });

  test("has no WordPress, dispatch, allowance, or generic continuation transport", () => {
    expect(service).not.toMatch(/fetch\(|writeGlw|continueGeneration|allowance/i);
    expect(service).toContain("DISPATCH_FORBIDDEN_DURING_RECONCILIATION");
    expect(service).toContain("wordpressMutationPerformed: false");
    expect(service).toContain("publicationPerformed: false");
    expect(service).toContain("workflowExecuted: false");
  });

  test("records authorization before job and target mutation", () => {
    const authorization = service.indexOf("const authorization =");
    expect(authorization).toBeLessThan(service.indexOf("await applyTerminal", authorization));
    expect(authorization).toBeLessThan(service.indexOf("transitionTarget", authorization));
  });
});