import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-localized-composition-service.ts"), "utf8");
const route = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/localized-preview-v2/route.ts"), "utf8");
const captureRoute = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/localized-preview-v2/certification/route.ts"), "utf8");
const renderer = readFileSync(join(process.cwd(), "src/modules/glw/GlwLocalizedRichCompositionPreview.tsx"), "utf8");

describe("San Antonio localized composition evidence boundary", () => {
  test("binds the immutable execution, artifact, authorized remediation, and approved product media", () => {
    for (const value of ["608895", "f518ffb7-9216-4866-a93c-7f4793e74038", "0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2", "c71fda6bb6cf635ec82730ed3f74422eaba39679", "wordpress-page:10541", "wordpress-media:10757", "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078"]) expect(service).toContain(value);
  });

  test("requires exact platform-admin create and capture operations", () => {
    expect(route).toContain("CREATE_SAN_ANTONIO_LOCALIZED_COMPOSITION_EVIDENCE_V1");
    expect(captureRoute).toContain("CAPTURE_SAN_ANTONIO_LOCALIZED_COMPOSITION_EVIDENCE_V1");
    expect(route).toContain('auth.roles.includes("platform_admin")');
    expect(captureRoute).toContain('auth.roles.includes("platform_admin")');
    expect(route).toContain("SAN_ANTONIO_LOCALIZED_JOB_ID");
    expect(captureRoute).toContain("SAN_ANTONIO_LOCALIZED_JOB_ID");
  });

  test("persists evidence only and exposes no workflow, WordPress, publication, or campaign mutation", () => {
    expect(service).not.toMatch(/execute_workflow|dispatchGlw|writeGlw|wordpressObjectId\s*:|markGlwCampaign|publishGlw/i);
    for (const source of [route, captureRoute]) {
      expect(source).toContain("regenerationPerformed: false");
      expect(source).toContain("workflowExecuted: false");
      expect(source).toContain("wordpressMutationPerformed: false");
      expect(source).toContain("campaignMutationPerformed: false");
      expect(source).toContain("publicationPerformed: false");
      expect(source).toContain("dispatchPerformed: false");
    }
  });

  test("uses all semantic roles and keeps documentary authority approved-existing", () => {
    for (const role of ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"]) expect(service).toContain(role);
    expect(service).toContain('source: "APPROVED_EXISTING"');
    expect(service).toContain('claimClass: "DOCUMENTARY"');
    expect(service).toContain('source: "GENERATED_CANDIDATE"');
  });

  test("shared renderer contains no Dallas or Houston reference literals", () => {
    expect(renderer).not.toMatch(/Dallas|Houston|North Texas|DFW/);
    expect(renderer).toContain("bundle.context.geography");
  });
});