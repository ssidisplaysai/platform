jest.mock("server-only", () => ({}));

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { GET, POST } from "@/app/api/glw/products/[productId]/media-authority/route";
import { authenticateOperator, createScryptPasswordHash, OPERATOR_CSRF_COOKIE, OPERATOR_CSRF_HEADER, OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";

const context = { params: Promise.resolve({ productId: "prod-outdoor-digital-sphere" }) };

describe("Outdoor Digital Sphere media authority route", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDirectory = process.env.GENESIS_OPERATOR_DIRECTORY_JSON;
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "outdoor-sphere-media-route-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; process.env.NODE_ENV = "production"; });
  afterEach(() => { if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot; if (originalDirectory === undefined) delete process.env.GENESIS_OPERATOR_DIRECTORY_JSON; else process.env.GENESIS_OPERATOR_DIRECTORY_JSON = originalDirectory; process.env.NODE_ENV = originalNodeEnv; rmSync(root, { recursive: true, force: true }); });

  test("caller role and scope headers cannot read or approve without a server session", async () => {
    const headers = { "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" };
    const getResponse = await GET(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { headers }), context);
    const postResponse = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA" }) }), context);
    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(readdirSync(root)).toEqual([]);
  });

  test("persists pending intake then a principal-bound approval without downstream mutations", async () => {
    const password = "correct horse battery staple";
    process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{ principalId: "robert", email: "robert@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 23)) }]);
    const session = await authenticateOperator({ identity: "robert", password });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const commonHeaders = { cookie, origin: "http://localhost", [OPERATOR_CSRF_HEADER]: session.csrfToken, "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" };
    const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#276749" } }).jpeg().toBuffer();
    const form = new FormData();
    form.set("action", "INTAKE_PRODUCT_MEDIA"); form.set("file", new File([bytes], "outdoor-sphere.jpg", { type: "image/jpeg" })); form.set("sourceType", "OWNER_SUPPLIED"); form.set("sourceDescription", "Owner supplied product photo."); form.set("provenance", "owner-upload:outdoor-sphere:test"); form.set("authorityClass", "PRODUCT_AUTHORITY"); form.set("usageScopes", JSON.stringify(["PRODUCT_AUTHORITY"])); form.set("depictsActualProduct", "true"); form.set("heroEligible", "true"); form.set("altTextAuthority", "Outdoor Digital Sphere"); form.set("captionAuthority", "Owner supplied.");
    const intake = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: commonHeaders, body: form }), context);
    expect(intake.status).toBe(201);
    const pending = await intake.json();
    expect(pending).toMatchObject({ record: { ownerApproval: "PENDING" }, ownerApprovalPersisted: false, n8nExecutionCreated: false, generationAttempted: false, wordpressMutation: false });
    const review = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: pending.record.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner supplied." }) }), context);
    expect(review.status).toBe(200);
    expect(await review.json()).toMatchObject({ record: { ownerApproval: "APPROVED", ownerPrincipalId: "robert", productRepresentationAllowed: true }, ownerApprovalPersisted: true, readiness: { heroAuthorityReady: true, supportingProductMediaReady: false, state: "PRODUCT_MEDIA_AUTHORITY_REQUIRED" }, n8nExecutionCreated: false, generationAttempted: false, wordpressMutation: false });
  });
});