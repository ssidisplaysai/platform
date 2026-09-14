import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(join(process.cwd(), "src/app/api/glw/pages/[jobId]/wordpress-staging/route.ts"), "utf8");
const authority = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-wordpress-staging-authority.ts"), "utf8");
const service = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-wordpress-staging-service.ts"), "utf8");
const renderer = readFileSync(join(process.cwd(), "src/modules/glw/san-antonio-wordpress-staging-render.ts"), "utf8");

describe("San Antonio owner-approved WordPress staging boundary", () => {
  test("binds the exact immutable owner-approved identity", () => { for (const value of ["69481665113d9a39dc206075e9496ff262b59e67", "0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2", "f518ffb7-9216-4866-a93c-7f4793e74038", "wordpress-media:${PRODUCT_MEDIA_ID}", "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078"]) expect(authority + service).toContain(value); });
  test("requires principal and session provenance beyond a role header", () => { expect(route).toContain("resolveRequestPrincipal"); expect(route).toContain('auth.roles.includes("platform_admin")'); expect(route).toContain("principal !== null"); expect(route).toContain("allowed.principal"); });
  test("uses a single-use grant and never invokes scheduler, dispatch, workflow, regeneration, or publication", () => { expect(authority).toContain("consumptions.some"); expect(authority).toContain("INVALID_OR_CONSUMED"); expect(service).not.toMatch(/RUN_DRAFT_BATCH|dispatchGlw|execute_workflow|generateGenesisFeaturedImage|publishGlw/i); for (const value of ["publicationPerformed: false", "dispatchPerformed: false", "workflowExecuted: false", "regenerationPerformed: false"]) expect(authority + route).toContain(value); });
  test("renders POST_CONTENT with one H1, 55/45 product authority, and every governed media role", () => { expect(renderer).toContain('data-wordpress-authority="POST_CONTENT"'); expect(renderer).toContain('data-product-authority-balance="55_45"'); expect(renderer).toContain("grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)"); expect(renderer).toContain("data-media-role"); for (const role of ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"]) expect(renderer).toContain(role); expect(service).toContain("h1\\b"); });
  test("blocks duplicates, Elementor shadow authority, forbidden locations, and development URLs", () => { expect(service).toContain("SAN_ANTONIO_WORDPRESS_COLLISION"); expect(service).toContain("MULTI_AUTHORITY"); expect(service).toContain("elementorDataPresent"); expect(service).toMatch(/Dallas\|Houston\|Austin\|Plano/); expect(service).toMatch(/localhost\|127/); });
  test("persists the uploaded media array after lifecycle reconciliation", () => { expect(service).toContain("uploadedMedia: uploaded"); expect(service).toContain('state: "LIFECYCLE_RECONCILED"'); });
});