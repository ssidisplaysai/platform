import {
  CAMPAIGN_PREFLIGHT_POLICY,
  completeCampaignPreflight,
  createCampaignPlan,
  getCampaignApprovalPacket,
  isCampaignPreflightStale,
  summarizeCampaign,
  type CampaignTargetPreflightResult,
} from "@/modules/foundation/campaign-plan";
import {
  createCampaignPlanRecord,
  getCampaignPlanRecord,
  listCampaignPlanRecords,
  resetCampaignPlanRepositoryForTests,
  saveCampaignPreflightRecord,
} from "@/modules/foundation/campaign-plan-repository";
import {
  classifyCampaignTargetPreflight,
  createGlwExactTargetPreflightReader,
  MASS_PREFLIGHT_LIMITS,
  preflightCampaign,
  type CampaignTargetPreflightReader,
} from "@/modules/foundation/campaign-preflight";
import { resolveGlwTargetPreflight, type GlwTargetPreflightResult } from "@/modules/glw/target-preflight";
import { GLW_PRODUCT_PAGE_BLUEPRINT } from "@/modules/foundation/page-blueprint";
import { buildTargetMatrixPreview, type TargetMatrix } from "@/modules/foundation/target-matrix";
import type { ProductPlanningCandidate, ResolvedOperatorTargetSelection } from "@/modules/foundation/target-selection-resolution";
import {
  getTargetInventoryPersistenceReplacementCount,
  listTargetInventoryRecords,
  resetTargetInventoryRepositoryForTests,
  upsertTargetInventoryBatch,
} from "@/modules/foundation/target-inventory-repository";
import type { TargetInventoryRecord } from "@/modules/foundation/target-inventory";

const ORGANIZATION_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const PLAN_FINGERPRINT = "5cdbe14dc73fd3d56f64488fad3f626308c41137da50eb6c921b6088691b0487";

function product(index: number): ProductPlanningCandidate {
  return {
    productFamilyId: "family-standard-dvled",
    productId: `campaign-product-${index}`,
    variantId: null,
    applicationProductSlug: `application-product-${index}`,
    canonicalProductSlug: `canonical-product-${index}`,
    organizationId: ORGANIZATION_ID,
    siteIds: [SITE_ID],
    eligible: true,
    reviewRequired: false,
    sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
  };
}

function matrix(targetCount = 1): TargetMatrix {
  const products = Array.from({ length: targetCount }, (_, index) => product(index));
  const resolved: ResolvedOperatorTargetSelection = {
    selection: {
      selectionId: `campaign-selection-${targetCount}`,
      organizationId: ORGANIZATION_ID,
      siteId: SITE_ID,
      pageBlueprintIds: [GLW_PRODUCT_PAGE_BLUEPRINT.pageBlueprintId],
      productSelection: { mode: "ALL_ELIGIBLE", values: [] },
      variantSelection: { mode: "ALL_ELIGIBLE", values: [] },
      stateSelection: { mode: "ONE", values: ["TX"] },
      citySelection: { mode: "ONE", values: [{ stateCode: "TX", citySlug: "austin" }] },
      catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
      catalogRevisionId: null,
      reconciliationPlanFingerprint: PLAN_FINGERPRINT,
      createdBy: "operator-1",
      createdAt: "2026-08-27T00:00:00.000Z",
      selectionSource: "campaign-preflight-test",
      notes: null,
    },
    blueprints: [GLW_PRODUCT_PAGE_BLUEPRINT],
    products,
    variants: [],
    states: [{ code: "TX", name: "Texas", slug: "texas" }],
    cities: [],
    filters: [],
    sourceProvenance: {
      catalogAuthority: "CERTIFIED_RECONCILIATION_PLAN",
      catalogRevisionId: null,
      reconciliationPlanFingerprint: PLAN_FINGERPRINT,
      selectionSource: "campaign-preflight-test",
    },
  };
  return buildTargetMatrixPreview({ resolved, now: "2026-08-27T00:00:00.000Z" });
}

function campaign(targetMatrix = matrix()) {
  return createCampaignPlan({
    matrix: targetMatrix,
    organizationId: ORGANIZATION_ID,
    siteId: SITE_ID,
    name: "Texas Indoor LED Video Wall Cities",
    createdBy: "operator-1",
    createdAt: "2026-08-27T00:00:00.000Z",
  });
}

function exactResult(
  target: TargetInventoryRecord,
  state: GlwTargetPreflightResult["state"],
  wordpressObjectId: string | null = null,
): GlwTargetPreflightResult {
  return resolveGlwTargetPreflight({
    identity: {
      applicationPath: target.applicationPath,
      canonicalPath: target.canonicalPath,
      canonicalProduct: target.subject.productId ?? "Product",
      canonicalProductSlug: target.canonicalPath.split("/")[0],
      canonicalSlug: target.canonicalSlug,
      canonicalParentId: state.startsWith("EXISTS_") ? "124" : null,
    },
    wordpressPages: state.startsWith("EXISTS_") ? [{
      id: Number(wordpressObjectId),
      slug: target.canonicalSlug,
      parent: 124,
      status: state === "EXISTS_PUBLISHED" ? "publish" : "draft",
      link: `https://example.test/?page_id=${wordpressObjectId}`,
      title: { rendered: "Exact target" },
    }] : null,
    inventoryComplete: state === "ABSENT",
    siteId: target.siteId,
    productId: target.subject.productId ?? "",
    stateName: target.geography.stateCode ?? "",
    cityName: target.geography.cityName ?? "",
  });
}

function classify(
  state: GlwTargetPreflightResult["state"],
  wordpressObjectId: string | null = null,
): CampaignTargetPreflightResult {
  const targetMatrix = matrix();
  const target = targetMatrix.targets[0];
  return classifyCampaignTargetPreflight({
    campaign: campaign(targetMatrix),
    target,
    preflight: exactResult(target, state, wordpressObjectId),
    attemptCount: 1,
    checkedAt: "2026-08-27T01:00:00.000Z",
  });
}

describe("002C campaign scope and identity", () => {
  test("1. campaign accepts a certified matrix and freezes exact target IDs", () => {
    const targetMatrix = matrix(3);
    const plan = campaign(targetMatrix);
    expect(plan).toMatchObject({ matrixId: targetMatrix.matrixId, matrixFingerprint: targetMatrix.fingerprint, targetCount: 3, status: "DRAFT" });
    expect(plan.targetIds).toEqual([...targetMatrix.targets.map((target) => target.targetId)].sort());
  });

  test("2. ad hoc empty or untracked target scope is rejected", () => {
    expect(() => campaign({ ...matrix(), matrixId: "", fingerprint: "", targets: [] })).toThrow("certified TargetMatrix");
  });

  test("3. campaign fingerprint is deterministic and excludes timestamps", () => {
    const targetMatrix = matrix(2);
    const first = campaign(targetMatrix);
    const second = createCampaignPlan({ matrix: targetMatrix, organizationId: ORGANIZATION_ID, siteId: SITE_ID, name: "Other label", createdBy: "other", createdAt: "2027-01-01" });
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  test("4. different matrix fingerprint changes campaign fingerprint", () => {
    expect(campaign(matrix(2)).fingerprint).not.toBe(campaign(matrix(3)).fingerprint);
  });

  test("5. different target set changes campaign fingerprint", () => {
    const first = matrix(2);
    const altered = { ...first, targets: first.targets.slice(0, 1), fingerprint: "altered-matrix", matrixId: "altered-matrix" };
    expect(campaign(altered).fingerprint).not.toBe(campaign(first).fingerprint);
  });

  test("6. different blueprint version changes campaign fingerprint", () => {
    const first = matrix();
    const changed = { ...first, blueprintVersions: { ...first.blueprintVersions, [GLW_PRODUCT_PAGE_BLUEPRINT.pageBlueprintId]: 2 } };
    expect(campaign(changed).fingerprint).not.toBe(campaign(first).fingerprint);
  });

  test("7. different preflight policy version changes fingerprint", () => {
    const targetMatrix = matrix();
    const first = campaign(targetMatrix);
    const changed = createCampaignPlan({ matrix: targetMatrix, organizationId: ORGANIZATION_ID, siteId: SITE_ID, name: "Campaign", createdBy: "operator", preflightPolicyVersion: "2.0.0" });
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  test("8. scope mutation after preflight start fails closed", () => {
    const targetMatrix = matrix();
    const plan = campaign(targetMatrix);
    expect(() => completeCampaignPreflight({ campaign: plan, matrix: { ...targetMatrix, fingerprint: "changed" }, results: [] })).toThrow("matrix identity changed");
  });

  test("9. policy retains draft intent and has no auto approval", () => {
    expect(campaign()).toMatchObject({ publicationIntent: "draft", approvedBy: null, approvedAt: null });
  });
});

describe("002C exact target classification", () => {
  test("10. ABSENT plans CREATE", () => {
    expect(classify("ABSENT")).toMatchObject({ targetState: "ABSENT", eligibility: "ELIGIBLE_CREATE", plannedOperation: "CREATE" });
  });

  test("11. exact draft ID plans EXACT_UPDATE", () => {
    expect(classify("EXISTS_DRAFT", "3001")).toMatchObject({ targetState: "EXISTS_DRAFT", eligibility: "ELIGIBLE_UPDATE", plannedOperation: "EXACT_UPDATE", wordpressObjectId: "3001" });
  });

  test("12. draft without an exact object ID is blocked", () => {
    const targetMatrix = matrix();
    const target = targetMatrix.targets[0];
    const result = classifyCampaignTargetPreflight({
      campaign: campaign(targetMatrix),
      target,
      preflight: { ...exactResult(target, "UNKNOWN"), state: "EXISTS_DRAFT", wordpressObjectId: null, wordpressStatus: "draft" },
      attemptCount: 1,
      checkedAt: "2026-08-27T01:00:00.000Z",
    });
    expect(result).toMatchObject({ targetState: "BLOCKED", plannedOperation: "BLOCKED", reasonCodes: ["EXACT_DRAFT_ID_MISSING"] });
  });

  test("13. published target is retained but not executable", () => {
    expect(classify("EXISTS_PUBLISHED", "18846")).toMatchObject({ targetState: "EXISTS_PUBLISHED", eligibility: "NOT_ELIGIBLE_PUBLISHED", plannedOperation: "NO_ACTION", wordpressObjectId: "18846" });
  });

  test("14. UNKNOWN is retained for review and never treated absent", () => {
    expect(classify("UNKNOWN")).toMatchObject({ targetState: "UNKNOWN", eligibility: "UNKNOWN_REQUIRES_PREFLIGHT", plannedOperation: "REVIEW_REQUIRED" });
  });

  test("15. network failure becomes UNKNOWN, not CREATE", async () => {
    const execution = await preflightCampaign({ campaign: campaign(), matrix: matrix(), reader: async () => { throw new Error("network"); }, timeoutMs: 10, persistInventory: false });
    expect(execution.results[0]).toMatchObject({ targetState: "UNKNOWN", plannedOperation: "REVIEW_REQUIRED", attemptCount: 2 });
  });

  test("16. invalid exact path is blocked with reason", () => {
    const targetMatrix = matrix();
    const target = targetMatrix.targets[0];
    const result = classifyCampaignTargetPreflight({ campaign: campaign(targetMatrix), target, preflight: { ...exactResult(target, "ABSENT"), canonicalPath: "wrong/path" }, attemptCount: 1, checkedAt: "2026-08-27" });
    expect(result).toMatchObject({ targetState: "BLOCKED", plannedOperation: "BLOCKED", reasonCodes: ["INVALID_TARGET_IDENTITY"] });
  });

  test("17. policy-blocked inventory target is retained without a read", async () => {
    const targetMatrix = matrix();
    const blockedMatrix = { ...targetMatrix, targets: [{ ...targetMatrix.targets[0], targetState: "BLOCKED" as const, eligibility: "NOT_ELIGIBLE_POLICY" as const }] };
    const reader = jest.fn();
    const execution = await preflightCampaign({ campaign: campaign(blockedMatrix), matrix: blockedMatrix, reader, persistInventory: false });
    expect(execution.results[0]).toMatchObject({ targetState: "BLOCKED", plannedOperation: "BLOCKED", reasonCodes: ["TARGET_POLICY_BLOCK"] });
    expect(reader).not.toHaveBeenCalled();
  });

  test("18. exact single-target authority can be adapted directly for mass reads", async () => {
    const reader = createGlwExactTargetPreflightReader({ wordpressApiBaseUrl: null });
    const target = matrix().targets[0];
    expect((await reader({
      ...target,
      subject: { ...target.subject, productId: "prod-indoor-led-video-wall" },
    })).state).toBe("UNKNOWN");
  });
});

describe("002C synthetic mass preflight and approval", () => {
  beforeEach(() => resetTargetInventoryRepositoryForTests());

  test("19. 100 targets aggregate 60 create, 10 update, 20 no-action, 5 review, and 5 blocked", async () => {
    const base = matrix(100);
    const targets = base.targets.map((target, index) => index >= 95
      ? { ...target, targetState: "BLOCKED" as const, eligibility: "NOT_ELIGIBLE_POLICY" as const }
      : target);
    const targetMatrix = { ...base, targets };
    const indexById = new Map(targets.map((target, index) => [target.targetId, index]));
    const reader: CampaignTargetPreflightReader = async (target) => {
      const index = indexById.get(target.targetId)!;
      if (index < 60) return exactResult(target, "ABSENT");
      if (index < 70) return exactResult(target, "EXISTS_DRAFT", String(3000 + index));
      if (index < 90) return exactResult(target, "EXISTS_PUBLISHED", String(18000 + index));
      throw new Error("unverified");
    };
    const execution = await preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader, persistInventory: false });
    expect(execution.campaign.preflightSummary).toMatchObject({
      totalTargets: 100,
      targetStateCounts: { ABSENT: 60, EXISTS_DRAFT: 10, EXISTS_PUBLISHED: 20, UNKNOWN: 5, BLOCKED: 5 },
      operationCounts: { CREATE: 60, EXACT_UPDATE: 10, NO_ACTION: 20, REVIEW_REQUIRED: 5, BLOCKED: 5 },
      executionEligibleCount: 70,
      executionBlockedCount: 30,
    });
    expect(execution.campaign.status).toBe("REVIEW_REQUIRED");
  });

  test("20. published targets alone do not prevent READY_FOR_APPROVAL", async () => {
    const targetMatrix = matrix(2);
    const reader = async (target: TargetInventoryRecord) => target.targetId === targetMatrix.targets[0].targetId
      ? exactResult(target, "ABSENT")
      : exactResult(target, "EXISTS_PUBLISHED", "18846");
    const execution = await preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader, persistInventory: false });
    expect(execution.campaign.status).toBe("READY_FOR_APPROVAL");
    expect(getCampaignApprovalPacket(execution.campaign, targetMatrix)).toMatchObject({
      createCount: 1,
      exactUpdateCount: 0,
      publishedExcludedCount: 1,
      estimatedExecutionCount: 1,
      approvalRequired: true,
      autoApprovalAllowed: false,
    });
  });

  test("21. unknown and blocked exclusions remain visible in approval packet", async () => {
    const base = matrix(2);
    const targetMatrix = { ...base, targets: [base.targets[0], { ...base.targets[1], targetState: "BLOCKED" as const }] };
    const execution = await preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader: async () => { throw new Error("network"); }, persistInventory: false });
    const packet = getCampaignApprovalPacket(execution.campaign, targetMatrix);
    expect(packet).toMatchObject({ unknownCount: 1, blockedCount: 1, estimatedExecutionCount: 0 });
    expect(packet.operatorWarnings).toHaveLength(2);
  });

  test("22. summaries retain by-blueprint, by-product, and by-state counts", () => {
    const results = [classify("ABSENT"), classify("EXISTS_DRAFT", "3001")];
    expect(summarizeCampaign(results)).toMatchObject({
      byBlueprint: { [GLW_PRODUCT_PAGE_BLUEPRINT.pageBlueprintId]: 2 },
      byProduct: { "campaign-product-0": 2 },
    });
  });

  test("23. illustrative 75-target approval packet retains every execution exclusion", async () => {
    const base = matrix(75);
    const targets = base.targets.map((target, index) => index === 74
      ? { ...target, targetState: "BLOCKED" as const, eligibility: "NOT_ELIGIBLE_POLICY" as const }
      : target);
    const targetMatrix = { ...base, targets };
    const indexById = new Map(targets.map((target, index) => [target.targetId, index]));
    const execution = await preflightCampaign({
      campaign: campaign(targetMatrix),
      matrix: targetMatrix,
      persistInventory: false,
      retryBackoffMs: 0,
      reader: async (target) => {
        const index = indexById.get(target.targetId)!;
        if (index < 52) return exactResult(target, "ABSENT");
        if (index < 56) return exactResult(target, "EXISTS_DRAFT", String(3000 + index));
        if (index < 71) return exactResult(target, "EXISTS_PUBLISHED", String(18000 + index));
        throw new Error("unknown");
      },
    });
    expect(getCampaignApprovalPacket(execution.campaign, targetMatrix)).toMatchObject({
      targetCount: 75,
      createCount: 52,
      exactUpdateCount: 4,
      publishedExcludedCount: 15,
      unknownCount: 3,
      blockedCount: 1,
      estimatedExecutionCount: 56,
      publicationIntent: "draft",
    });
  });
});

describe("002C bounded concurrency, retries, freshness, and inventory persistence", () => {
  beforeEach(() => {
    resetTargetInventoryRepositoryForTests();
    resetCampaignPlanRepositoryForTests();
  });

  test("24. maximum in-flight reads never exceeds configured concurrency", async () => {
    const targetMatrix = matrix(25);
    let inFlight = 0;
    let observed = 0;
    const reader: CampaignTargetPreflightReader = async (target) => {
      inFlight += 1;
      observed = Math.max(observed, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return exactResult(target, "ABSENT");
    };
    const execution = await preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader, concurrency: 3, persistInventory: false });
    expect(observed).toBeLessThanOrEqual(3);
    expect(execution.metrics.observedMaximumInFlight).toBeLessThanOrEqual(3);
  });

  test("25. one transient failure retries the same exact target once", async () => {
    const calls: string[] = [];
    const execution = await preflightCampaign({
      campaign: campaign(),
      matrix: matrix(),
      reader: async (target) => {
        calls.push(target.targetId);
        if (calls.length === 1) throw new Error("transient");
        return exactResult(target, "ABSENT");
      },
      retryBackoffMs: 0,
      persistInventory: false,
    });
    expect(execution.results[0]).toMatchObject({ targetState: "ABSENT", attemptCount: 2 });
    expect(new Set(calls).size).toBe(1);
  });

  test("26. permanent failure stops after two total attempts", async () => {
    const reader = jest.fn().mockRejectedValue(new Error("permanent"));
    const execution = await preflightCampaign({ campaign: campaign(), matrix: matrix(), reader, retryBackoffMs: 0, persistInventory: false });
    expect(reader).toHaveBeenCalledTimes(2);
    expect(execution.metrics.maximumObservedAttempts).toBe(2);
  });

  test("27. campaign target bound is enforced before reads", async () => {
    const targetMatrix = matrix(MASS_PREFLIGHT_LIMITS.maximumTargetsPerCampaign + 1);
    const reader = jest.fn();
    await expect(preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader })).rejects.toThrow("exceeds the preflight limit");
    expect(reader).not.toHaveBeenCalled();
  }, 30_000);

  test("28. 30-minute TTL distinguishes fresh and stale results", () => {
    const result = classify("ABSENT");
    expect(isCampaignPreflightStale({ result, now: "2026-08-27T01:29:59.000Z" })).toBe(false);
    expect(isCampaignPreflightStale({ result, now: "2026-08-27T01:30:01.000Z" })).toBe(true);
    expect(CAMPAIGN_PREFLIGHT_POLICY.resultTtlMs).toBe(1_800_000);
  });

  test("29. preflight policy version is retained on every result", async () => {
    const execution = await preflightCampaign({ campaign: campaign(), matrix: matrix(), reader: async (target) => exactResult(target, "ABSENT"), persistInventory: false });
    expect(execution.results[0].preflightPolicyVersion).toBe("1.0.0");
  });

  test("30. inventory inserts and updates exact metadata in one atomic replacement", async () => {
    const targetMatrix = matrix(10);
    const identities = targetMatrix.targets.map((target) => target.identity);
    const execution = await preflightCampaign({ campaign: campaign(targetMatrix), matrix: targetMatrix, reader: async (target) => exactResult(target, "ABSENT") });
    expect(execution.metrics.inventoryPersistenceReplacementCount).toBe(1);
    expect(getTargetInventoryPersistenceReplacementCount()).toBe(1);
    expect(listTargetInventoryRecords().map((target) => target.identity)).toEqual(identities);
    expect(listTargetInventoryRecords().every((target) => target.lastPreflightAt && target.preflightPolicyVersion === "1.0.0")).toBe(true);
  });

  test("31. invalid metadata batch produces no partial update", () => {
    const targetMatrix = matrix(2);
    upsertTargetInventoryBatch({ targets: targetMatrix.targets });
    const before = listTargetInventoryRecords();
    const { updateTargetInventoryMetadataBatch } = jest.requireActual("@/modules/foundation/target-inventory-repository");
    expect(() => updateTargetInventoryMetadataBatch({
      updates: [
        { targetId: before[0].targetId, expectedTargetVersion: 1, patch: { targetState: "ABSENT" } },
        { targetId: before[1].targetId, expectedTargetVersion: 999, patch: { targetState: "ABSENT" } },
      ],
    })).toThrow("Expected target version 999");
    expect(listTargetInventoryRecords()).toEqual(before);
  });

  test("32. 1000 mocked targets are all accounted once with bounded persistence", async () => {
    const targetMatrix = matrix(1_000);
    const execution = await preflightCampaign({
      campaign: campaign(targetMatrix),
      matrix: targetMatrix,
      reader: async (target) => exactResult(target, "ABSENT"),
    });
    expect(execution.results).toHaveLength(1_000);
    expect(new Set(execution.results.map((result) => result.targetId)).size).toBe(1_000);
    expect(listTargetInventoryRecords()).toHaveLength(1_000);
    expect(execution.metrics.observedMaximumInFlight).toBeLessThanOrEqual(5);
    expect(execution.metrics.inventoryPersistenceReplacementCount).toBe(1);
  }, 30_000);

  test("33. result order does not affect campaign summary or completed result order", () => {
    const targetMatrix = matrix(2);
    const plan = campaign(targetMatrix);
    const results = targetMatrix.targets.map((target, index) => classifyCampaignTargetPreflight({ campaign: plan, target, preflight: exactResult(target, index ? "EXISTS_PUBLISHED" : "ABSENT", index ? "18846" : null), attemptCount: 1, checkedAt: "2026-08-27" }));
    const forward = completeCampaignPreflight({ campaign: plan, matrix: targetMatrix, results });
    const reverse = completeCampaignPreflight({ campaign: plan, matrix: targetMatrix, results: [...results].reverse() });
    expect(reverse.preflightSummary).toEqual(forward.preflightSummary);
    expect(reverse.preflightResults).toEqual(forward.preflightResults);
  });

  test("34. campaign plans persist but cannot persist approved execution state", () => {
    const plan = createCampaignPlanRecord(campaign());
    expect(getCampaignPlanRecord(plan.campaignId)).toEqual(plan);
    expect(listCampaignPlanRecords()).toHaveLength(1);
    expect(() => saveCampaignPreflightRecord({ campaign: { ...plan, status: "APPROVED", version: 2 }, expectedVersion: 1 })).toThrow("cannot persist approved");
  });

  test("35. completed preflight persists without changing frozen scope", async () => {
    const targetMatrix = matrix();
    const draft = createCampaignPlanRecord(campaign(targetMatrix));
    const execution = await preflightCampaign({ campaign: draft, matrix: targetMatrix, reader: async (target) => exactResult(target, "ABSENT"), persistInventory: false });
    const saved = saveCampaignPreflightRecord({ campaign: execution.campaign, expectedVersion: 1 });
    expect(saved).toMatchObject({ status: "READY_FOR_APPROVAL", version: 2, fingerprint: draft.fingerprint, targetIds: draft.targetIds });
  });

  test("36. campaign module exposes no execution entrypoint or runtime records", () => {
    const plan = campaign() as unknown as Record<string, unknown>;
    expect(plan.executeCampaign).toBeUndefined();
    expect(plan.executionStatus).toBeUndefined();
    expect(plan.approvedBy).toBeNull();
  });

  test("37. preflight is read-only planning with no generation, n8n, WordPress mutation, or catalog mutation fields", async () => {
    const execution = await preflightCampaign({ campaign: campaign(), matrix: matrix(), reader: async (target) => exactResult(target, "ABSENT"), persistInventory: false });
    const serialized = JSON.stringify(execution);
    expect(serialized).not.toContain("generationJob");
    expect(serialized).not.toContain("n8nExecution");
    expect(serialized).not.toContain("wordpressMutation");
    expect(serialized).not.toContain("catalogApply");
  });
});