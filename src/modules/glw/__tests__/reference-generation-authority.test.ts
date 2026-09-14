jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GlwCampaign } from "../campaign-types";
import { buildGlwExactRetryContract, generationAuthorityBindingsMatch, resolveGlwReferenceGenerationAuthority } from "../reference-generation-authority";
import { evaluateGlwReferenceClaimAuthority, GLW_REFERENCE_CLAIM_CLASSES, GLW_REFERENCE_QA_POLICY_VERSION } from "../reference-claim-authority";
import { projectGlwReferenceRetryReadiness, projectGlwReferenceWorkflow } from "../reference-workflow-state";

const campaign = {
  campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
  organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production",
  productId: "prod-outdoor-digital-sphere", pageType: "state_service", stateCodes: ["IL", "IN"],
} as GlwCampaign;

describe("GLW exact reference generation authority", () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "glw-reference-authority-")); });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  test("binds exact instructions, reference bytes, product authority, and versioned QA", () => {
    const storagePath = join(directory, "reference.pdf");
    const bytes = Buffer.from("exact reference bytes");
    writeFileSync(storagePath, bytes);
    const authority = resolveGlwReferenceGenerationAuthority({
      campaign,
      stateCode: "IN",
      pack: { campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId, instructions: "Exact approved instructions", references: [{ referenceId: "ref-1", campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId, kind: "document", scope: "campaign", role: "content_reference", fileName: "Outdoor Digital Sphere Installations (2).pdf", mediaType: "application/pdf", sizeBytes: bytes.length, storagePath, createdAt: "2030-01-01" }], updatedAt: "2030-01-01" },
    });
    expect(authority).toMatchObject({ campaignInstructionsLoaded: true, referenceFingerprint: createHash("sha256").update(bytes).digest("hex"), productAuthorityKnown: true, productAuthorityPath: "/outdoor-digital-sphere/", qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION });
    expect(generationAuthorityBindingsMatch(authority, authority)).toBe(true);
    expect(generationAuthorityBindingsMatch(authority, { ...authority, referenceFingerprint: "stale" })).toBe(false);
  });

  test("prepares an exact non-executable retry requiring new authorization", () => {
    const binding = { campaignInstructionFingerprint: "a", referenceFingerprint: "b", productAuthorityFingerprint: "c", qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION };
    expect(buildGlwExactRetryContract({ campaign, binding, failedJobId: "failed-il", failedArtifactSha256: "d", wordpressReadAuthority: "site:READY", exactRuntime: "commit" })).toMatchObject({ referenceState: "IN", failedJobId: "failed-il", ownerAuthorizationRequired: true, previousAuthorityReusable: false, automaticRetry: false, duplicateProtection: true, executable: false });
    const failed = projectGlwReferenceWorkflow({ status: "FAILED", errorCode: "GENERATED_CONTENT_QA_FAILED", qaFailureReasons: { stateProductAuthorityLink: "missing" }, jobId: "failed-il", state: "Illinois", updatedAt: "2030-01-01", generatedDraft: { contentHtml: "<p>evidence</p>" } } as never);
    expect(projectGlwReferenceRetryReadiness(failed, "IN", true)).toMatchObject({ state: "REFERENCE_RETRY_READY", nextReferenceStateCode: "IN", retryRequiresNewOwnerAuthorization: true, retryExecutable: false });
  });

  test("implements every required claim class", () => {
    expect(GLW_REFERENCE_CLAIM_CLASSES).toEqual(["LOCATION_FACT", "MARKET_ADOPTION", "CLIMATE", "PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "DURABILITY", "INGRESS_PROTECTION", "BRIGHTNESS", "INTERACTIVITY", "REMOTE_MANAGEMENT", "INSTALLATION_SERVICE", "TRAINING", "WARRANTY", "SERVICE_AVAILABILITY", "PRICING", "INVENTORY"]);
  });
});

const forensicRoot = process.env.GLW_FORENSIC_PERSISTENCE_DIR;
(forensicRoot ? test : test.skip)("exact preserved Illinois artifact fails hardened claim QA without mutation", () => {
  const repositoryPath = join(forensicRoot!, "glw-page-execution-repository.json");
  const before = readFileSync(repositoryPath);
  const envelope = JSON.parse(before.toString("utf8")) as { data: { records: Array<{ jobId: string; generatedDraft: { contentHtml: string } }> } };
  const job = envelope.data.records.find((record) => record.jobId === "3df15069-2cd8-4aec-93f3-70a9f5ee3029");
  expect(job).toBeDefined();
  expect(createHash("sha256").update(job!.generatedDraft.contentHtml).digest("hex")).toBe("eed2b6450c8ba975c78e51e5f603993a4306632e48946ffb64c2128b7b404371");
  const result = evaluateGlwReferenceClaimAuthority({ artifact: job!.generatedDraft as never });
  expect(result.ok).toBe(false);
  expect(result.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length).toBeGreaterThan(0);
  expect(readFileSync(repositoryPath)).toEqual(before);
});