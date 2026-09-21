import fs from "node:fs";
import path from "node:path";

describe("existing WordPress onboarding orchestration contract", () => {
  const onboardingCreateRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/sites/onboarding-create/route.ts"),
    "utf8",
  );
  const onboardingFlow = fs.readFileSync(
    path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"),
    "utf8",
  );
  const onboardingAssessmentRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/sites/[siteId]/onboarding-assessment/route.ts"),
    "utf8",
  );

  test("accepts existing intent and reuses matching authority when available", () => {
    expect(onboardingCreateRoute).toContain('const onboardingIntent = body.onboardingIntent === "existing" ? "existing" : "fresh";');
    expect(onboardingCreateRoute).toContain('bindingResult: "existing_authority_bound"');
    expect(onboardingCreateRoute).toContain("authorityReused: true");
  });

  test("creates a safe existing authority shell when no match is found", () => {
    expect(onboardingCreateRoute).toContain('bindingResult: onboardingIntent === "existing"');
    expect(onboardingCreateRoute).toContain('? "existing_authority_created"');
    expect(onboardingCreateRoute).toContain('enabled: false');
    expect(onboardingCreateRoute).toContain('publicationPolicy: "draft_only"');
    expect(onboardingCreateRoute).toContain('defaultPublicationStatus: "draft"');
    expect(onboardingCreateRoute).toContain('wordpressCredentialReference: null');
  });

  test("keeps fresh intent duplicate protection intact", () => {
    expect(onboardingCreateRoute).toContain('if (onboardingIntent === "fresh")');
    expect(onboardingCreateRoute).toContain('error: "SITE_ALREADY_EXISTS"');
    expect(onboardingCreateRoute).toContain('code: "SITE_ALREADY_EXISTS"');
  });

  test("executes existing intent from the onboarding UI without dead-end warning", () => {
    expect(onboardingFlow).toContain('onboardingIntent: intent');
    expect(onboardingFlow).toContain('if (intent === "existing")');
    expect(onboardingFlow).toContain('Bind Existing Site Authority');
    expect(onboardingFlow).not.toContain("is not certified in V1");
  });

  test("preserves bounded no-mutation signals in assessment output", () => {
    expect(onboardingAssessmentRoute).toContain("testedByMutation: false");
    expect(onboardingAssessmentRoute).toContain("writeCapability");
    expect(onboardingAssessmentRoute).toContain("existingSiteAssessment");
    expect(onboardingAssessmentRoute).toContain('wordpressAuthentication: "READ_ONLY_AUTHENTICATED"');
  });

  test("does not introduce browser-stored credential handling in onboarding flow", () => {
    expect(onboardingFlow).not.toMatch(/localStorage|sessionStorage/);
    expect(onboardingFlow).toContain('type="password"');
    expect(onboardingFlow).toContain("Store Credentials");
  });
});
