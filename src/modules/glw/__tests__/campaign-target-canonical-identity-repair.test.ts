import {
  initializeGlwCampaignTargets,
  listGlwCampaignTargets,
  repairGlwCampaignTargetCanonicalIdentity,
} from "../campaign-target-repository";
import { listGlwCampaignTargetCanonicalIdentityRepairs } from "../campaign-target-canonical-identity-repair-audit";

describe("campaign target canonical identity repair", () => {
  test("repairs only missing canonical identity metadata and records a durable audit receipt", () => {
    const campaignId = `campaign-canonical-repair-${process.pid}-${Date.now()}`;
    initializeGlwCampaignTargets({
      campaignId,
      organizationId: "org",
      siteId: "site",
      productId: "product",
      stateCodes: ["CT"],
      referenceStateCode: "CT",
      referenceJobId: "job-ct",
      referenceWordpressObjectId: "20158",
    });

    const before = listGlwCampaignTargets(campaignId).find((target) => target.stateCode === "CT");
    expect(before).toBeTruthy();
    expect(before?.canonicalPath ?? null).toBeNull();

    const repaired = repairGlwCampaignTargetCanonicalIdentity({
      campaignId,
      stateCode: "CT",
      targetId: before!.targetId,
      jobId: "job-ct",
      externalExecutionId: "685446",
      wordpressObjectId: "20158",
      canonicalPath: "outdoor-digital-sphere/connecticut",
      applicationPath: "outdoor-digital-sphere/connecticut",
      canonicalParentId: "20114",
      wordpressParentSlug: "outdoor-digital-sphere",
      wordpressChildSlug: "connecticut",
      repairedBy: "platform_admin",
    });

    expect(repaired.target.status).toBe(before?.status);
    expect(repaired.target.jobId).toBe(before?.jobId);
    expect(repaired.target.wordpressObjectId).toBe(before?.wordpressObjectId);
    expect(repaired.target.canonicalPath).toBe("outdoor-digital-sphere/connecticut");
    expect(repaired.target.applicationPath).toBe("outdoor-digital-sphere/connecticut");
    expect(repaired.target.canonicalParentId).toBe("20114");

    const audit = listGlwCampaignTargetCanonicalIdentityRepairs().find((entry) => entry.repairReceiptId === repaired.receipt.repairReceiptId);
    expect(audit).toBeTruthy();
    expect(audit?.campaignId).toBe(campaignId);
    expect(audit?.targetId).toBe(before?.targetId);
    expect(audit?.mutationApplied).toBe(true);
    expect(audit?.canonicalPathBefore).toBeNull();
    expect(audit?.canonicalPathAfter).toBe("outdoor-digital-sphere/connecticut");
  });

  test("fails closed when existing canonical path conflicts", () => {
    const campaignId = `campaign-canonical-conflict-${process.pid}-${Date.now()}`;
    initializeGlwCampaignTargets({
      campaignId,
      organizationId: "org",
      siteId: "site",
      productId: "product",
      stateCodes: ["CT"],
      referenceStateCode: "CT",
      referenceJobId: "job-ct",
      referenceWordpressObjectId: "20158",
    });

    const current = listGlwCampaignTargets(campaignId).find((target) => target.stateCode === "CT");
    expect(current).toBeTruthy();

    repairGlwCampaignTargetCanonicalIdentity({
      campaignId,
      stateCode: "CT",
      targetId: current!.targetId,
      jobId: "job-ct",
      externalExecutionId: "685446",
      wordpressObjectId: "20158",
      canonicalPath: "outdoor-digital-sphere/connecticut",
      applicationPath: "outdoor-digital-sphere/connecticut",
      canonicalParentId: "20114",
      wordpressParentSlug: "outdoor-digital-sphere",
      wordpressChildSlug: "connecticut",
      repairedBy: "platform_admin",
    });

    expect(() => repairGlwCampaignTargetCanonicalIdentity({
      campaignId,
      stateCode: "CT",
      targetId: current!.targetId,
      jobId: "job-ct",
      externalExecutionId: "685446",
      wordpressObjectId: "20158",
      canonicalPath: "outdoor-digital-sphere/rhode-island",
      applicationPath: "outdoor-digital-sphere/rhode-island",
      canonicalParentId: "20114",
      wordpressParentSlug: "outdoor-digital-sphere",
      wordpressChildSlug: "rhode-island",
      repairedBy: "platform_admin",
    })).toThrow("TARGET_CANONICAL_IDENTITY_REPAIR_CANONICAL_PATH_CONFLICT");
  });

  test("requires exact job and wordpress object identity", () => {
    const campaignId = `campaign-canonical-binding-${process.pid}-${Date.now()}`;
    initializeGlwCampaignTargets({
      campaignId,
      organizationId: "org",
      siteId: "site",
      productId: "product",
      stateCodes: ["CT"],
      referenceStateCode: "CT",
      referenceJobId: "job-ct",
      referenceWordpressObjectId: "20158",
    });

    const current = listGlwCampaignTargets(campaignId).find((target) => target.stateCode === "CT");
    expect(current).toBeTruthy();

    expect(() => repairGlwCampaignTargetCanonicalIdentity({
      campaignId,
      stateCode: "CT",
      targetId: current!.targetId,
      jobId: "wrong-job",
      externalExecutionId: "685446",
      wordpressObjectId: "20158",
      canonicalPath: "outdoor-digital-sphere/connecticut",
      applicationPath: "outdoor-digital-sphere/connecticut",
      canonicalParentId: "20114",
      wordpressParentSlug: "outdoor-digital-sphere",
      wordpressChildSlug: "connecticut",
      repairedBy: "platform_admin",
    })).toThrow("TARGET_CANONICAL_IDENTITY_REPAIR_JOB_MISMATCH");

    expect(() => repairGlwCampaignTargetCanonicalIdentity({
      campaignId,
      stateCode: "CT",
      targetId: current!.targetId,
      jobId: "job-ct",
      externalExecutionId: "685446",
      wordpressObjectId: "99999",
      canonicalPath: "outdoor-digital-sphere/connecticut",
      applicationPath: "outdoor-digital-sphere/connecticut",
      canonicalParentId: "20114",
      wordpressParentSlug: "outdoor-digital-sphere",
      wordpressChildSlug: "connecticut",
      repairedBy: "platform_admin",
    })).toThrow("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_OBJECT_MISMATCH");
  });
});
