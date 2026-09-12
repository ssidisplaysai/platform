import fs from "node:fs";
import path from "node:path";

describe("post-visual approval Site QA UI", () => {
  const review = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteBuildWordPressDraftReview.tsx"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/wordpress-review/page.tsx"), "utf8");
  const designsRoute = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/designs/page.tsx"), "utf8");
  const siteQa = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/site-qa/page.tsx"), "utf8");
  const siteQaAction = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteQaContinuationAction.tsx"), "utf8");
  const navigation = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteNavigationReviewWorkflow.tsx"), "utf8");
  const publication = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SitePublicationGateWorkflow.tsx"), "utf8");
  const execution = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SitePublicationExecutionWorkflow.tsx"), "utf8");
  const executor = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-publication-executor.ts"), "utf8");
  const executionPlan = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-publication-execution-plan.ts"), "utf8");

  test("removes stale Home and remaining-design continuation from WordPress Review", () => {
    expect(review).not.toContain("Review the designed Home");
    expect(review).not.toContain("blocked until approval");
    expect(route).not.toContain("SiteVisualPropagationAction");
    expect(route).toContain("All Site Designs Approved");
    expect(route).toContain("workspace.next.route");
  });

  test("renders authorized execution review and a receipt-driven final action without auto-execution", () => {
    expect(publication).toContain("REVIEW PUBLICATION EXECUTION");
    for (const text of ["Exact WordPress page publications", "Navigation/menu operation", "Static front page", "Media and SEO verification", "Genesis state transition", "Final verification", "EXECUTE APPROVED PUBLICATION", "REVIEW COMPLETED SITE"]) expect(execution).toContain(text);
    for (const text of ["publishGenesisWordPressDraft", "checkpointSitePublicationExecutionPlan", 'operation.status === "SUCCEEDED"', "FINAL_WORDPRESS_VERIFICATION_FAILED"]) expect(executor).toContain(text);
    expect(execution).not.toContain('onClick={execute()}');
  });

  test("fails closed on draft-only policy and orders front-page and Genesis mutations safely", () => {
    for (const text of ["Execution Blocked", "AUTHORIZE PUBLICATION POLICY", "This changes only the policy", "disabled={busy || !preflight.ready}"]) expect(execution).toContain(text);
    expect(executionPlan).toContain("GENESIS_PUBLICATION_POLICY_TRANSITION_REQUIRED");
    expect(executionPlan.indexOf('kind: "SET_STATIC_FRONT_PAGE"')).toBeGreaterThan(executionPlan.indexOf('kind: "PUBLISH_PAGE"'));
    expect(executionPlan.indexOf('kind: "TRANSITION_GENESIS_SITE"')).toBeGreaterThan(executionPlan.indexOf('kind: "FINAL_VERIFICATION"'));
    expect(executor).toContain('operation.status === "SUCCEEDED"');
    expect(executor.indexOf("updateSite(site.siteId")).toBeGreaterThan(executor.indexOf("FINAL_WORDPRESS_VERIFICATION_FAILED"));
    expect(executor).not.toContain('publicationPolicy: "publish_after_gates"');
  });

  test("renders explicit QA, navigation, readiness, and authorization actions without publication", () => {
    expect(siteQa).toContain("SiteQaContinuationAction");
    for (const text of ["Site QA Passed", "REVIEW NAVIGATION"]) expect(siteQaAction).toContain(text);
    for (const text of ["APPROVE NAVIGATION", "REQUEST CHANGES", "REGENERATE / REASSEMBLE WITH INSTRUCTIONS", "Footer navigation proposal", "Position"]) expect(navigation).toContain(text);
    for (const text of ["REQUEST PUBLICATION AUTHORIZATION", "AUTHORIZE PUBLICATION", "does not publish pages"]) expect(publication).toContain(text);
    expect(siteQa).not.toMatch(/PUBLISH SITE|ENABLE SITE/);
    expect(navigation).not.toMatch(/PUBLISH SITE|ENABLE SITE/);
  });

  test("shows the completed visual ladder and redirects completed design review to Site QA", () => {
    for (const label of ["WordPress Draft Review", "Site Visual Review", "Site QA"]) expect(review).toContain(label);
    expect(review).toContain('step.rank < currentRank ? "COMPLETE"');
    expect(designsRoute).toContain('"SITE_QA", "NAVIGATION_REVIEW", "PUBLICATION_READINESS", "PUBLICATION_AUTHORIZATION"');
    expect(designsRoute).toContain("redirect(workspace.next.route)");
  });
});