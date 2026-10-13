import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GenerationReadinessResult } from "../site-generation-readiness";

const scope = { organizationId: "rj-metal", siteId: "site-rj" };
function readiness(): GenerationReadinessResult {
  return { readyToCertify: true, checks: [], blockers: [], snapshot: { strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" }, counts: { marketDecisions: 1, capabilityReviews: 1, productAuthorityProposed: 4, productAuthorityDecisions: 4, productAuthorityRemaining: 0, generationEligibleProducts: 4, approvedFactualSources: 0, ownerAttestedAuthority: 4, evidenceVerifiedAuthority: 0, referenceOnlySources: 0, publishableAssets: 0, nonPublishableReferences: 0 }, publication: { state: "disabled", requiredForGenerationReadiness: false } };
}

describe("Generation Readiness certification repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "generation-certification-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior; fs.rmSync(directory, { recursive: true, force: true }); });

  test("viewing status is read-only and explicit certification is traceable without starting a build", async () => {
    const repository = await import("../site-generation-readiness-repository");
    expect(repository.getGenerationCertification({ ...scope, snapshot: readiness().snapshot })).toEqual({ certification: null, status: "NOT_CERTIFIED" });
    expect(fs.existsSync(path.join(directory, "site-generation-readiness-repository.json"))).toBe(false);
    const certification = repository.certifyGenerationReadiness({ ...scope, actor: "site-owner", readiness: readiness() });
    expect(certification).toMatchObject({ ...scope, revision: 1, certifiedBy: "site-owner", strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" });
    expect(certification.certifiedAt).toBeTruthy();
    expect(repository.getGenerationCertification({ ...scope, snapshot: readiness().snapshot }).status).toBe("CURRENT");
    expect(repository.getSiteBuildSession(scope)).toBeNull();
    for (const name of ["site-repository.json", "site-intelligence-repository.json", "site-product-authority-repository.json", "product-repository.json", "glw-campaign-repository.json", "wordpress-credential-store.json"]) expect(fs.existsSync(path.join(directory, name))).toBe(false);
  });

  test("every material upstream fingerprint invalidates certification while an unchanged snapshot remains current", async () => {
    const repository = await import("../site-generation-readiness-repository");
    repository.certifyGenerationReadiness({ ...scope, actor: "owner", readiness: readiness() });
    for (const snapshot of [
      { ...readiness().snapshot, strategyRevision: 9 },
      { ...readiness().snapshot, creativeRevision: 2 },
      { ...readiness().snapshot, marketFingerprint: "changed" },
      { ...readiness().snapshot, capabilityFingerprint: "changed" },
      { ...readiness().snapshot, productServiceFingerprint: "changed" },
      { ...readiness().snapshot, sourcesFingerprint: "changed" },
      { ...readiness().snapshot, generationPolicyVersion: "v2" },
    ]) expect(repository.getGenerationCertification({ ...scope, snapshot }).status).toBe("STALE");
  });

  test("certification is blocked when checks fail and Site Build requires a separate call", async () => {
    const repository = await import("../site-generation-readiness-repository");
    expect(() => repository.certifyGenerationReadiness({ ...scope, actor: "owner", readiness: { ...readiness(), readyToCertify: false, blockers: ["blocked"] } })).toThrow("GENERATION_READINESS_BLOCKED");
    const certification = repository.certifyGenerationReadiness({ ...scope, actor: "owner", readiness: readiness() });
    expect(repository.getSiteBuildSession(scope)).toBeNull();
    expect(repository.startSiteBuild({ ...scope, actor: "owner", certification })).toMatchObject({ ...scope, certificationId: certification.certificationId, state: "STARTED", startedBy: "owner" });
  });
});