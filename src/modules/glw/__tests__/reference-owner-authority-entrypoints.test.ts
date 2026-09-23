import { readFileSync } from "node:fs";
import { join } from "node:path";

const campaignRoute = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8");
const generationRoute = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
const authorityRoute = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-authority/route.ts"), "utf8");
const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8");

describe("GLW reference owner authority entry points", () => {
  test("campaign entry consumes trusted owner authority before generation forwarding", () => {
    const principal = campaignRoute.indexOf("resolveGlwTrustedOperatorPrincipal(request)");
    const consume = campaignRoute.indexOf("consumeGlwReferenceOwnerGrant({");
    const forward = campaignRoute.indexOf("const generationResponse = await fetch");
    expect(principal).toBeGreaterThan(0);
    expect(consume).toBeGreaterThan(principal);
    expect(forward).toBeGreaterThan(consume);
    expect(campaignRoute).not.toContain('if (target.state.code === "IN")');
  });

  test("direct generation entry consumes one-time claim before mutation checks and dispatch", () => {
    const claim = generationRoute.indexOf("consumeGlwReferenceOwnerClaimForDispatch({");
    const mutation = generationRoute.lastIndexOf("verifyMutationAuthority(preview.request, preview.siteRecord)");
    const dispatch = generationRoute.indexOf("service.execute(preview.request)");
    expect(claim).toBeGreaterThan(0);
    expect(mutation).toBeGreaterThan(claim);
    expect(dispatch).toBeGreaterThan(mutation);
    expect(generationRoute).toContain("identityBoundReferenceCampaign");
    expect(generationRoute).toContain('candidate.status === "draft"');
    expect(generationRoute).toContain('action === "retry_failed_execution"');
    expect(generationRoute).toContain("validateGlwReferenceOwnerClaimForTerminalFailedExecutionRetry");
  });

  test("exact PageRun continuation is separated from generation dispatch authority", () => {
    expect(campaignRoute).toContain('const exactPageRunContinuation = body?.action === "continue";');
    expect(campaignRoute).toContain("!exactPageRunContinuation && !generationAuthorityBindingsMatch");
    expect(campaignRoute).toContain("!terminalExecutionRetry && !exactPageRunContinuation");
    expect(generationRoute).toContain('const exactPageRunContinuation = action === "continue" && Boolean(pageRunId);');
    expect(generationRoute).toContain("if (!exactPageRunContinuation) {");
    expect(generationRoute).toContain("Continuation job/execution does not match the authoritative PageRun.");
  });

  test("issuance route resolves trusted principal before accepting action data", () => {
    expect(authorityRoute.indexOf("resolveGlwTrustedOperatorPrincipal(request)")).toBeLessThan(authorityRoute.indexOf("await request.json()"));
    expect(authorityRoute).toContain("callerSuppliedRoleHeadersAuthorize: false");
  });

  test("operator UI names exact action and remains unambiguous when unavailable", () => {
    for (const marker of ["Owner Action Authority", "Run Retry Preflight", "Authorize One Retry", "Authorize Reference Generation", "Failed job:", "Principal authority:", "Unavailable:"]) {
      expect(ui).toContain(marker);
    }
  });
});