import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-production/route.ts"), "utf8");
const snapshot = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-production/snapshot/route.ts"), "utf8");

describe("target rich-reference production route security", () => {
  test("exposes one authenticated shared operation with server-resolved inputs", () => {
    expect(route).toContain("export async function POST");
    expect(route).toContain('authorizeRequest(request, "sites:update")');
    expect(route).toContain("resolveGlwTrustedOperatorPrincipal");
    expect(route).toContain("runTargetRichReferenceProductionOperation");
    expect(route).toContain("resolveApprovedRichReferenceSource");
    expect(route).not.toContain("execute_workflow");
    expect(route).not.toContain("createGlwDraftExecutionService");
    expect(route).not.toContain("publishGenesisWordPress");
  });

  test("accepts only durable identities and never client-supplied content or URLs", () => {
    expect(route).toContain('["targetId", "jobId", "referenceCandidateId"]');
    expect(route).not.toMatch(/body\.(?:contentHtml|referenceArtifactHtml|mediaAssignments|targetUrl|wordpressObjectId)/);
    expect(route.match(/writeGenesisWordPressDraft\(/g)).toHaveLength(2);
    expect(route).toContain('operation === "UPDATE"');
    expect(route).toContain('operation: "CREATE"');
  });

  test("requires a signed snapshot and verifies exact draft identity", () => {
    expect(snapshot).toContain("verifyGovernedSnapshotPath");
    expect(snapshot).toContain('text(page.status) !== "draft"');
    expect(snapshot).toContain("sha256(raw) !== expectedContentSha");
    expect(snapshot).toContain('settings.hide_title !== "yes"');
    expect(snapshot).toContain('"noindex,nofollow"');
  });
});
