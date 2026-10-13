import { readFileSync } from "node:fs";
import { join } from "node:path";

const scheduler = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/scheduler/route.ts"), "utf8");
const grantRoute = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/dispatch-authorization/route.ts"), "utf8");
const controls = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignOperatorControls.tsx"), "utf8");
const uiFlow = readFileSync(join(process.cwd(), "src/modules/glw/exact-target-dispatch-ui-flow.ts"), "utf8");
const authority = readFileSync(join(process.cwd(), "src/modules/glw/exact-target-dispatch-authority.ts"), "utf8");

describe("exact target scheduler boundary", () => {
  test("blocks role-only, generic, bulk, and incomplete scheduler requests", () => {
    expect(scheduler).toContain("resolveRequestPrincipal(request)");
    expect(scheduler).toContain("OWNER_DISPATCH_PRINCIPAL_REQUIRED");
    expect(scheduler).toContain('body?.confirm !== "AUTHORIZE_AND_DISPATCH_EXACT_TARGET"');
    expect(scheduler).toContain("body.preflightReceiptId");
    expect(scheduler).toContain("body.ownerDispatchGrantId");
    expect(scheduler).toContain("body.targetId");
    expect(scheduler).not.toContain('body?.confirm === "RUN_DRAFT_BATCH"');
    expect(scheduler).not.toContain('body?.confirm === "RUN_EXACT_DRAFT_TARGETS"');
    expect(scheduler).not.toContain('body?.confirm === "RESUME_EXISTING_DRAFT_TARGETS"');
  });

  test("validates and receipts exact authority before lease, job, MCP dispatch, or allowance mutation", () => {
    const authorization = scheduler.indexOf("authorizeExactTargetDispatchRequest({");
    const release = scheduler.indexOf("if (!releaseAuthority.capability.ready)", authorization);
    const mcp = scheduler.indexOf("await preflightGlwN8nMcpExecution()", authorization);
    const targetPreflight = scheduler.indexOf("await readGlwTargetPreflight({", authorization);
    const mutationAvailability = scheduler.indexOf("resolveGlwTargetMutationAvailability(targetPreflight", authorization);
    const lease = scheduler.indexOf("leaseGlwCampaignTargets({", authorization);
    const job = scheduler.indexOf("fetch(", lease);
    expect(authorization).toBeGreaterThan(-1);
    expect(authorization).toBeLessThan(release);
    expect(authorization).toBeLessThan(mcp);
    expect(authorization).toBeLessThan(targetPreflight);
    expect(authorization).toBeLessThan(mutationAvailability);
    expect(authorization).toBeLessThan(lease);
    expect(targetPreflight).toBeLessThan(lease);
    expect(mutationAvailability).toBeLessThan(lease);
    expect(authorization).toBeLessThan(job);
    expect(scheduler).toContain("GLW_TARGET_MUTATION_AUTHORITY_REQUIRED");
    expect(scheduler).toContain("appendDispatchRequestOutcome");
    expect(scheduler).toContain("requestReceiptId");
  });

  test("creates owner grant without dispatch and binds principal, preflight, target, operation, and runtime", () => {
    expect(grantRoute).toContain('body?.operation !== "OWNER_EXACT_TARGET_DISPATCH"');
    expect(grantRoute).toContain('body.confirmationMode !== "AUTHORIZE_AND_DISPATCH_EXACT_TARGET"');
    expect(grantRoute).toContain("resolveRequestPrincipal(request)");
    expect(grantRoute).toContain("preflightReceiptId: body.preflightReceiptId");
    expect(grantRoute).toContain("candidate.targetId === body.targetId");
    expect(grantRoute).toContain("runtimeSha");
    expect(grantRoute).toContain("dispatchPerformed: false");
    expect(grantRoute).toContain("workflowExecuted: false");
  });

  test("uses exact owner-facing language and two-step request flow", () => {
    const uiBoundary = `${controls}\n${uiFlow}`;
    expect(uiBoundary).toContain("Authorize & Dispatch");
    expect(uiBoundary).toContain("OWNER_EXACT_TARGET_DISPATCH");
    expect(uiBoundary).toContain("AUTHORIZE_AND_DISPATCH_EXACT_TARGET");
    expect(uiBoundary).toContain("/dispatch-authorization");
    expect(uiBoundary).toContain("preflight.preflightReceiptId");
    expect(uiBoundary).toContain("grantPayload.grant.grantId");
    expect(uiBoundary).toContain("target.targetId");
    expect(uiBoundary).not.toContain('confirm: "RUN_DRAFT_BATCH"');
  });

  test("persists redacted request provenance and no secret-bearing fields", () => {
    for (const field of ["requestReceiptId", "timestamp", "route", "method", "runtimeSha", "organizationId", "siteId", "campaignId", "targetId", "principal", "confirmationMode", "preflightReceiptId", "ownerDispatchGrantId", "grantValidationResult", "releaseAuthorityResult", "wordpressAuthorityResult", "mcpPreflightResult", "allowanceBefore", "allowanceAfter", "leaseId", "jobId", "externalExecutionId"]) expect(authority).toContain(field);
    expect(authority).not.toMatch(/cookie|applicationPassword|bearerToken|authorizationSecret/i);
  });
});
