jest.mock("server-only", () => ({}));
jest.mock("@/modules/glw/reference-aware-image-service", () => ({ generateGenesisFeaturedImageWithCampaignReferences: jest.fn() }));

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { GET, POST } from "@/app/api/glw/products/[productId]/media-authority/route";
import { authenticateOperator, createScryptPasswordHash, OPERATOR_CSRF_COOKIE, OPERATOR_CSRF_HEADER, OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";
import { generateGenesisFeaturedImageWithCampaignReferences } from "@/modules/glw/reference-aware-image-service";

const context = { params: Promise.resolve({ productId: "prod-outdoor-digital-sphere" }) };

describe("Outdoor Digital Sphere media authority route", () => {
  const originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDirectory = process.env.GENESIS_OPERATOR_DIRECTORY_JSON;
  const originalGitCommit = process.env.GIT_COMMIT;
  const originalTrustedLocalOperator = process.env.GENESIS_TRUSTED_LOCAL_OPERATOR;
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "outdoor-sphere-media-route-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; process.env.NODE_ENV = "production"; process.env.GIT_COMMIT = "a".repeat(40); process.env.GENESIS_TRUSTED_LOCAL_OPERATOR = "false"; });
  afterEach(() => { if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot; if (originalDirectory === undefined) delete process.env.GENESIS_OPERATOR_DIRECTORY_JSON; else process.env.GENESIS_OPERATOR_DIRECTORY_JSON = originalDirectory; if (originalGitCommit === undefined) delete process.env.GIT_COMMIT; else process.env.GIT_COMMIT = originalGitCommit; if (originalTrustedLocalOperator === undefined) delete process.env.GENESIS_TRUSTED_LOCAL_OPERATOR; else process.env.GENESIS_TRUSTED_LOCAL_OPERATOR = originalTrustedLocalOperator; process.env.NODE_ENV = originalNodeEnv; rmSync(root, { recursive: true, force: true }); });

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
    expect(pending).toMatchObject({ record: { ownerApproval: "PENDING_OWNER_APPROVAL", depictsActualProduct: false, productRepresentationAllowed: false, heroEligible: false, proposedUsageScopes: ["PRODUCT_AUTHORITY"], approvedUsageScopes: [] }, readiness: { approvedProductAuthorityMediaCount: 0, heroAuthorityReady: false, state: "PRODUCT_MEDIA_AUTHORITY_REQUIRED" }, ownerApprovalPersisted: false, n8nExecutionCreated: false, generationAttempted: false, wordpressMutation: false });
    const reviewBody = { action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: pending.record.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner supplied.", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: false };
    const wrongSite = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json", "x-gcp-site-id": "wrong-site" }, body: JSON.stringify(reviewBody) }), context);
    expect(wrongSite.status).toBe(404);
    const wrongProduct = await POST(new NextRequest("http://localhost/api/glw/products/wrong-product/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify(reviewBody) }), { params: Promise.resolve({ productId: "wrong-product" }) });
    expect(wrongProduct.status).toBe(404);
    const unconfirmed = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: pending.record.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner supplied." }) }), context);
    expect(unconfirmed.status).toBe(409);
    expect(await unconfirmed.json()).toMatchObject({ error: "PRODUCT_MEDIA_REVIEW_CONFIRMATION_REQUIRED", downstreamSideEffectsPerformed: false });
    const review = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: pending.record.mediaAuthorityId, decision: "APPROVE", authorityClass: "PRODUCT_AUTHORITY", usageScopes: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "Outdoor Digital Sphere", captionAuthority: "Owner supplied.", authorityAndScopesConfirmed: true, localAtmosphereConfirmed: true, localAtmosphereStateCodes: ["TX"] }) }), context);
    expect(review.status).toBe(200);
    const approved = await review.json();
    expect(approved).toMatchObject({ record: { ownerApproval: "APPROVED", ownerApprovalTimestamp: expect.any(String), ownerPrincipalId: "robert", approvedUsageScopes: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"], localAtmosphereStateCodes: ["TX"], productRepresentationAllowed: true, heroSelected: false }, ownerApprovalPersisted: true, readiness: { heroAuthorityReady: false, supportingProductMediaReady: true, state: "PRODUCT_MEDIA_AUTHORITY_REQUIRED" }, n8nExecutionCreated: false, generationAttempted: false, wordpressMutation: false });
    const correction = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "CORRECT_APPROVED_PRODUCT_MEDIA_USAGE_SCOPE", targets: [{ mediaAuthorityId: pending.record.mediaAuthorityId, hash: pending.record.hash }], removedScope: "LOCAL_CONTEXTUAL_ATMOSPHERE", reason: "Texas provenance does not establish Indiana-local authority." }) }), context);
    expect(correction.status).toBe(200);
    expect(await correction.json()).toMatchObject({ correctedRecords: [{ ownerApproval: "APPROVED", ownerApprovalTimestamp: approved.record.ownerApprovalTimestamp, ownerPrincipalId: "robert", approvedUsageScopes: ["PRODUCT_AUTHORITY"], localAtmosphereStateCodes: [], productRepresentationAllowed: true, localAtmosphereUseAllowed: false }], scopeCorrectionMutated: true, generationAttempted: false, wordpressMutation: false });
    const heroContext = { mediaAuthorityId: pending.record.mediaAuthorityId, hash: pending.record.hash, replacementConfirmed: false };
    const preflight = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "RUN_HERO_PREFLIGHT", ...heroContext }) }), context);
    expect(preflight.status).toBe(200);
    const receipt = await preflight.json();
    const authorization = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "AUTHORIZE_HERO_SELECTION", ...heroContext, preflightReceiptId: receipt.receipt.receiptId }) }), context);
    expect(authorization.status).toBe(200);
    const granted = await authorization.json();
    const selectionBody = { action: "SELECT_PRODUCT_MEDIA_HERO", ...heroContext, preflightReceiptId: receipt.receipt.receiptId, grantId: granted.grant.grantId };
    const selection = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify(selectionBody) }), context);
    expect(selection.status).toBe(200);
    expect(await selection.json()).toMatchObject({ record: { heroEligible: true, heroSelected: true, heroSelectedBy: "robert", heroSelectedAt: expect.any(String) }, readiness: { heroAuthorityReady: true }, heroSelectionPersisted: true, downstreamSideEffectsPerformed: false });
    const replay = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify(selectionBody) }), context);
    expect(replay.status).toBe(409);
    expect(await replay.json()).toMatchObject({ error: "PRODUCT_MEDIA_HERO_GRANT_CONSUMED", downstreamSideEffectsPerformed: false });
    const reload = await GET(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority?stateCode=IN", { headers: { cookie, "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" } }), context);
    expect(reload.status).toBe(200);
    expect(await reload.json()).toMatchObject({ records: [{ mediaAuthorityId: pending.record.mediaAuthorityId, ownerApproval: "APPROVED", ownerApprovalTimestamp: approved.record.ownerApprovalTimestamp, ownerPrincipalId: "robert", approvedUsageScopes: ["PRODUCT_AUTHORITY"], productRepresentationAllowed: true, localAtmosphereUseAllowed: false, heroSelected: true, heroSelectedBy: "robert" }], readiness: { approvedProductAuthorityMediaCount: 1, approvedLocalAtmosphereMediaCount: 0, heroAuthorityReady: true } });
  });

  test("creates a generated HERO visual candidate pending review and keeps hero selection separately governed", async () => {
    const password = "correct horse battery staple";
    process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{ principalId: "robert", email: "robert@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 24)) }]);
    const session = await authenticateOperator({ identity: "robert", password });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const commonHeaders = { cookie, origin: "http://localhost", [OPERATOR_CSRF_HEADER]: session.csrfToken, "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" };

    const groundedBytes = await sharp({ create: { width: 64, height: 40, channels: 3, background: "#2f855a" } }).jpeg().toBuffer();
    const groundedForm = new FormData();
    groundedForm.set("action", "INTAKE_PRODUCT_MEDIA");
    groundedForm.set("file", new File([groundedBytes], "grounded.jpg", { type: "image/jpeg" }));
    groundedForm.set("sourceType", "OWNER_SUPPLIED");
    groundedForm.set("sourceDescription", "Grounded owner product image.");
    groundedForm.set("provenance", "owner-upload:grounded");
    groundedForm.set("authorityClass", "PRODUCT_AUTHORITY");
    groundedForm.set("usageScopes", JSON.stringify(["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"]));
    groundedForm.set("depictsActualProduct", "true");
    groundedForm.set("heroEligible", "false");
    groundedForm.set("altTextAuthority", "Grounded product image");
    groundedForm.set("captionAuthority", "Grounded");
    const groundedIntake = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: commonHeaders, body: groundedForm }), context);
    const groundedPending = await groundedIntake.json();
    await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_PRODUCT_MEDIA",
        mediaAuthorityId: groundedPending.record.mediaAuthorityId,
        decision: "APPROVE",
        authorityClass: "PRODUCT_AUTHORITY",
        usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"],
        depictsActualProduct: true,
        heroEligible: false,
        altTextAuthority: "Grounded product image",
        captionAuthority: "Grounded",
        authorityAndScopesConfirmed: true,
        localAtmosphereConfirmed: false,
      }),
    }), context);

    const generatedBytes = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#4a5568" } }).jpeg().toBuffer();
    (generateGenesisFeaturedImageWithCampaignReferences as jest.Mock).mockResolvedValue({ ok: true, image: { bytes: generatedBytes, mimeType: "image/jpeg", fileExtension: "jpg", provider: "OPENAI_IMAGE", model: "gpt-image-2", width: 1536, height: 1024, reportedCost: "UNKNOWN" } });

    const generate = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        action: "GENERATE_VISUAL_CANDIDATE",
        candidateRole: "HERO",
        campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
        visualDirection: "Nighttime hero concept with premium architectural atmosphere.",
      }),
    }), context);
    expect(generate.status).toBe(201);
    const generated = await generate.json();
    expect(generated.record).toMatchObject({
      sourceType: "GENESIS_GENERATED_VISUAL_CANDIDATE",
      generatedCandidateRole: "HERO",
      authorityClass: "CONTEXTUAL_IN_USE",
      proposedUsageScopes: ["CONTEXTUAL_IN_USE"],
      ownerApproval: "PENDING_OWNER_APPROVAL",
      heroEligible: false,
      heroSelected: false,
    });

    const approved = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_PRODUCT_MEDIA",
        mediaAuthorityId: generated.record.mediaAuthorityId,
        decision: "APPROVE",
        authorityClass: "CONTEXTUAL_IN_USE",
        usageScopes: ["CONTEXTUAL_IN_USE"],
        depictsActualProduct: false,
        heroEligible: false,
        altTextAuthority: generated.record.altTextAuthority,
        captionAuthority: generated.record.captionAuthority,
        authorityAndScopesConfirmed: true,
        localAtmosphereConfirmed: false,
      }),
    }), context);
    expect(approved.status).toBe(200);
    const approvedBody = await approved.json();
    expect(approvedBody.record).toMatchObject({ ownerApproval: "APPROVED", heroEligible: true, heroSelected: false, productRepresentationAllowed: false });

    const heroContext = { mediaAuthorityId: generated.record.mediaAuthorityId, hash: generated.record.hash, replacementConfirmed: false };
    const preflight = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "RUN_HERO_PREFLIGHT", ...heroContext }) }), context);
    expect(preflight.status).toBe(200);
    const receipt = await preflight.json();
    const authorization = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "AUTHORIZE_HERO_SELECTION", ...heroContext, preflightReceiptId: receipt.receipt.receiptId }) }), context);
    const grant = await authorization.json();
    const selection = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: { ...commonHeaders, "content-type": "application/json" }, body: JSON.stringify({ action: "SELECT_PRODUCT_MEDIA_HERO", ...heroContext, preflightReceiptId: receipt.receipt.receiptId, grantId: grant.grant.grantId }) }), context);
    expect(selection.status).toBe(200);
    expect(await selection.json()).toMatchObject({ record: { heroSelected: true, heroSelectedBy: "robert" }, heroSelectionPersisted: true });
  });

  test("persists canonical owner reject for generated hero candidate without deleting history", async () => {
    const password = "correct horse battery staple";
    process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{ principalId: "robert", email: "robert@example.com", roles: ["platform_admin"], passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 29)) }]);
    const session = await authenticateOperator({ identity: "robert", password });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const commonHeaders = { cookie, origin: "http://localhost", [OPERATOR_CSRF_HEADER]: session.csrfToken, "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" };

    const groundedBytes = await sharp({ create: { width: 64, height: 40, channels: 3, background: "#2f855a" } }).jpeg().toBuffer();
    const groundedForm = new FormData();
    groundedForm.set("action", "INTAKE_PRODUCT_MEDIA");
    groundedForm.set("file", new File([groundedBytes], "grounded.jpg", { type: "image/jpeg" }));
    groundedForm.set("sourceType", "OWNER_SUPPLIED");
    groundedForm.set("sourceDescription", "Grounded owner product image.");
    groundedForm.set("provenance", "owner-upload:grounded");
    groundedForm.set("authorityClass", "PRODUCT_AUTHORITY");
    groundedForm.set("usageScopes", JSON.stringify(["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"]));
    groundedForm.set("depictsActualProduct", "true");
    groundedForm.set("heroEligible", "false");
    groundedForm.set("altTextAuthority", "Grounded product image");
    groundedForm.set("captionAuthority", "Grounded");
    const groundedIntake = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", { method: "POST", headers: commonHeaders, body: groundedForm }), context);
    const groundedPending = await groundedIntake.json();

    await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_PRODUCT_MEDIA",
        mediaAuthorityId: groundedPending.record.mediaAuthorityId,
        decision: "APPROVE",
        authorityClass: "PRODUCT_AUTHORITY",
        usageScopes: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"],
        depictsActualProduct: true,
        heroEligible: false,
        altTextAuthority: "Grounded product image",
        captionAuthority: "Grounded",
        authorityAndScopesConfirmed: true,
        localAtmosphereConfirmed: false,
      }),
    }), context);

    const generatedBytes = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#4a5568" } }).jpeg().toBuffer();
    (generateGenesisFeaturedImageWithCampaignReferences as jest.Mock).mockResolvedValue({ ok: true, image: { bytes: generatedBytes, mimeType: "image/jpeg", fileExtension: "jpg", provider: "OPENAI_IMAGE", model: "gpt-image-2", width: 1536, height: 1024, reportedCost: "UNKNOWN" } });
    const generate = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({ action: "GENERATE_VISUAL_CANDIDATE", candidateRole: "HERO", visualDirection: "Reject-flow candidate" }),
    }), context);
    const pendingGenerated = await generate.json();
    expect(pendingGenerated.record).toMatchObject({ ownerApproval: "PENDING_OWNER_APPROVAL", heroEligible: false, heroSelected: false });

    const reject = await POST(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority", {
      method: "POST",
      headers: { ...commonHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_PRODUCT_MEDIA",
        mediaAuthorityId: pendingGenerated.record.mediaAuthorityId,
        decision: "REJECT",
        authorityClass: "CONTEXTUAL_IN_USE",
        usageScopes: ["CONTEXTUAL_IN_USE"],
        depictsActualProduct: false,
        heroEligible: false,
        altTextAuthority: pendingGenerated.record.altTextAuthority,
        captionAuthority: pendingGenerated.record.captionAuthority,
        authorityAndScopesConfirmed: false,
        localAtmosphereConfirmed: false,
      }),
    }), context);
    expect(reject.status).toBe(200);
    const rejected = await reject.json();
    expect(rejected).toMatchObject({
      ownerApprovalPersisted: true,
      record: {
        mediaAuthorityId: pendingGenerated.record.mediaAuthorityId,
        ownerApproval: "REJECTED",
        heroEligible: false,
        heroSelected: false,
      },
    });

    const reload = await GET(new NextRequest("http://localhost/api/glw/products/prod-outdoor-digital-sphere/media-authority?stateCode=IN", { headers: { cookie, "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" } }), context);
    expect(reload.status).toBe(200);
    const payload = await reload.json();
    expect(payload.records.find((record: { mediaAuthorityId: string }) => record.mediaAuthorityId === pendingGenerated.record.mediaAuthorityId)).toMatchObject({
      mediaAuthorityId: pendingGenerated.record.mediaAuthorityId,
      ownerApproval: "REJECTED",
      heroEligible: false,
      heroSelected: false,
    });
  });
});