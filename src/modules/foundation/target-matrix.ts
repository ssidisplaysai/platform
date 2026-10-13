import { createCanonicalContentHash } from "./canonical-content-hash";
import type { PageBlueprint } from "./page-blueprint";
import {
  expandTargetInventoryPreview,
  summarizeTargetInventory,
  TARGET_EXPANSION_LIMITS,
  TargetPlanningError,
  type TargetGeographyCandidate,
  type TargetInventoryRecord,
  type TargetInventorySummary,
  type TargetSubjectCandidate,
} from "./target-inventory";
import {
  getTargetInventoryRepositoryRevision,
  listTargetInventoryRecords,
  upsertTargetInventoryBatch,
  type UpsertTargetInventoryBatchResult,
} from "./target-inventory-repository";
import type {
  ProductPlanningCandidate,
  ResolvedOperatorTargetSelection,
  TargetSelectionFilter,
  TargetSelectionFilterReason,
  VariantPlanningCandidate,
} from "./target-selection-resolution";

export type TargetMatrixMode = "PREVIEW_ONLY" | "MATERIALIZE_INVENTORY";

export type TargetMatrixCardinality = {
  byBlueprint: Readonly<Record<string, number>>;
  theoreticalTargetCount: number;
  limit: number;
  overLimit: boolean;
};

export type TargetMatrixSummary = {
  selectedProductCount: number;
  selectedVariantCount: number;
  selectedStateCount: number;
  selectedCityCount: number;
  blueprintCount: number;
  theoreticalTargetCount: number;
  materializedBeforeDedupCount: number;
  deduplicatedTargetCount: number;
  duplicateTargetCount: number;
  filteredTargetCount: number;
  filterReasonCounts: Readonly<Record<TargetSelectionFilterReason, number>>;
  inventory: TargetInventorySummary;
};

export type OperatorTargetMatrixPreviewRow = {
  targetId: string;
  blueprintKey: string;
  productFamilyId: string | null;
  productId: string | null;
  variantId: string | null;
  stateCode: string | null;
  cityName: string | null;
  applicationPath: string;
  canonicalPath: string;
  targetState: TargetInventoryRecord["targetState"];
  eligibility: TargetInventoryRecord["eligibility"];
  catalogAuthority: TargetInventoryRecord["sourceProvenance"]["catalogAuthority"];
  publicationIntent: "draft";
};

export type TargetMatrix = {
  matrixId: string;
  selectionId: string;
  catalogAuthority: ResolvedOperatorTargetSelection["selection"]["catalogAuthority"];
  catalogRevisionId: string | null;
  reconciliationPlanFingerprint: string | null;
  blueprintVersions: Readonly<Record<string, number>>;
  cardinality: TargetMatrixCardinality;
  targets: readonly TargetInventoryRecord[];
  filters: readonly TargetSelectionFilter[];
  summary: TargetMatrixSummary;
  previewRows: readonly OperatorTargetMatrixPreviewRow[];
  publicationIntent: "draft";
  fingerprint: string;
  createdAt: string;
};

export type MaterializedTargetMatrix = {
  matrix: TargetMatrix;
  persistence: UpsertTargetInventoryBatchResult;
};

function stateGeography(state: ResolvedOperatorTargetSelection["states"][number]): TargetGeographyCandidate {
  return {
    countryCode: "US",
    stateCode: state.code,
    stateName: state.name,
    stateSlug: state.slug,
    cityName: null,
    citySlug: null,
    localityKey: null,
  };
}

function blueprintGeographies(
  blueprint: PageBlueprint,
  resolved: ResolvedOperatorTargetSelection,
): readonly TargetGeographyCandidate[] {
  if (blueprint.requiredDimensions.includes("CITY")) return resolved.cities;
  if (blueprint.requiredDimensions.includes("STATE")) return resolved.states.map(stateGeography);
  return [];
}

function blueprintProducts(
  blueprint: PageBlueprint,
  resolved: ResolvedOperatorTargetSelection,
  filters: TargetSelectionFilter[],
): readonly ProductPlanningCandidate[] {
  return resolved.products.filter((product) => {
    if (blueprint.subjectScope.allowedCatalogAuthorities.includes(product.sourceAuthority) === false) {
      filters.push({ reason: "BLUEPRINT_NOT_ALLOWED", subjectId: product.productId, details: `${blueprint.key} excludes ${product.sourceAuthority}.` });
      return false;
    }
    if (blueprint.subjectScope.allowedProductFamilyIds.length > 0
      && (!product.productFamilyId || !blueprint.subjectScope.allowedProductFamilyIds.includes(product.productFamilyId))) {
      filters.push({ reason: "FAMILY_NOT_ELIGIBLE", subjectId: product.productId, details: `${blueprint.key} excludes product family ${product.productFamilyId ?? "unknown"}.` });
      return false;
    }
    return true;
  });
}

function variantSubjects(input: {
  blueprint: PageBlueprint;
  products: readonly ProductPlanningCandidate[];
  variants: readonly VariantPlanningCandidate[];
  filters: TargetSelectionFilter[];
}): readonly TargetSubjectCandidate[] {
  if (!input.blueprint.requiredDimensions.includes("VARIANT")) return input.products;
  if (!input.blueprint.subjectScope.variantPagesEnabled) {
    input.filters.push({ reason: "BLUEPRINT_NOT_ALLOWED", subjectId: input.blueprint.pageBlueprintId, details: "Variant pages are disabled for this blueprint." });
    return [];
  }
  const products = new Map(input.products.map((product) => [product.productId, product]));
  return input.variants.flatMap((variant) => {
    const product = products.get(variant.productId);
    if (!product) return [];
    if (!variant.pageWorthy) {
      input.filters.push({ reason: "VARIANT_NOT_PAGE_WORTHY", subjectId: variant.variantId, details: "Variant page-worthiness is not authorized." });
      return [];
    }
    return [{ ...product, variantId: variant.variantId }];
  });
}

function validateRequiredSelection(
  blueprint: PageBlueprint,
  subjects: readonly TargetSubjectCandidate[],
  geographies: readonly TargetGeographyCandidate[],
): void {
  const missing: string[] = [];
  if (blueprint.requiredDimensions.includes("PRODUCT") && subjects.length === 0) missing.push("PRODUCT");
  if (blueprint.requiredDimensions.includes("VARIANT") && subjects.every((subject) => !subject.variantId)) missing.push("VARIANT");
  if (blueprint.requiredDimensions.includes("STATE") && geographies.every((geography) => !geography.stateCode)) missing.push("STATE");
  if (blueprint.requiredDimensions.includes("CITY") && geographies.every((geography) => !geography.citySlug)) missing.push("CITY");
  if (missing.length > 0) {
    throw new TargetPlanningError("MISSING_REQUIRED_DIMENSION", `${blueprint.key} requires resolved ${missing.join(", ")}.`);
  }
}

export function calculateTargetMatrixCardinality(input: {
  resolved: ResolvedOperatorTargetSelection;
  maximumTargets?: number;
}): TargetMatrixCardinality {
  const filters = [...input.resolved.filters];
  const byBlueprint: Record<string, number> = {};
  input.resolved.blueprints.forEach((blueprint) => {
    const products = blueprintProducts(blueprint, input.resolved, filters);
    const subjects = variantSubjects({ blueprint, products, variants: input.resolved.variants, filters });
    const geographies = blueprintGeographies(blueprint, input.resolved);
    validateRequiredSelection(blueprint, subjects, geographies);
    const geographyMultiplier = blueprint.requiredDimensions.some((dimension) =>
      dimension === "COUNTRY" || dimension === "STATE" || dimension === "CITY")
      ? geographies.length
      : 1;
    byBlueprint[blueprint.pageBlueprintId] = subjects.length * geographyMultiplier;
  });
  const theoreticalTargetCount = Object.values(byBlueprint).reduce((total, count) => total + count, 0);
  const limit = input.maximumTargets ?? TARGET_EXPANSION_LIMITS.maximumTargetsPerPreview;
  return { byBlueprint, theoreticalTargetCount, limit, overLimit: theoreticalTargetCount > limit };
}

function identityPayload(target: TargetInventoryRecord): unknown {
  return {
    identity: target.identity,
    applicationPath: target.applicationPath,
    canonicalPath: target.canonicalPath,
    subject: target.subject,
    geography: target.geography,
  };
}

export function deduplicateMatrixTargets(
  targets: readonly TargetInventoryRecord[],
): { targets: readonly TargetInventoryRecord[]; duplicateCount: number } {
  const unique = new Map<string, TargetInventoryRecord>();
  targets.forEach((target) => {
    const existing = unique.get(target.targetId);
    if (existing && createCanonicalContentHash(identityPayload(existing)) !== createCanonicalContentHash(identityPayload(target))) {
      throw new TargetPlanningError("TARGET_IDENTITY_MISMATCH", `Target ${target.targetId} has materially different identity payloads.`);
    }
    unique.set(target.targetId, existing ?? target);
  });
  return {
    targets: [...unique.values()].sort((left, right) => left.targetId.localeCompare(right.targetId)),
    duplicateCount: targets.length - unique.size,
  };
}

function preserveExistingTargets(
  targets: readonly TargetInventoryRecord[],
  existingTargets: readonly TargetInventoryRecord[],
): readonly TargetInventoryRecord[] {
  const existingById = new Map(existingTargets.map((target) => [target.targetId, target]));
  return targets.map((target) => {
    const existing = existingById.get(target.targetId);
    if (!existing) return target;
    if (createCanonicalContentHash(identityPayload(existing)) !== createCanonicalContentHash(identityPayload(target))) {
      throw new TargetPlanningError("TARGET_IDENTITY_MISMATCH", `Existing target ${target.targetId} has a different identity payload.`);
    }
    return existing;
  });
}

function filterCounts(filters: readonly TargetSelectionFilter[]): Record<TargetSelectionFilterReason, number> {
  const reasons: TargetSelectionFilterReason[] = [
    "PRODUCT_NOT_ELIGIBLE",
    "PRODUCT_REVIEW_REQUIRED",
    "FAMILY_NOT_ELIGIBLE",
    "BLUEPRINT_NOT_ALLOWED",
    "VARIANT_NOT_PAGE_WORTHY",
    "ATTRIBUTE_NOT_PAGE_WORTHY",
    "GEOGRAPHY_NOT_ELIGIBLE",
    "MISSING_REQUIRED_DIMENSION",
    "TARGET_LIMIT_EXCEEDED",
    "DUPLICATE_TARGET",
  ];
  return Object.fromEntries(reasons.map((reason) => [reason, filters.filter((filter) => filter.reason === reason).length])) as Record<TargetSelectionFilterReason, number>;
}

function semanticSelection(resolved: ResolvedOperatorTargetSelection): unknown {
  return {
    selectionId: resolved.selection.selectionId,
    organizationId: resolved.selection.organizationId,
    siteId: resolved.selection.siteId,
    catalogAuthority: resolved.selection.catalogAuthority,
    catalogRevisionId: resolved.selection.catalogRevisionId,
    reconciliationPlanFingerprint: resolved.selection.reconciliationPlanFingerprint,
    products: resolved.products.map((product) => product.productId).sort(),
    variants: resolved.variants.map((variant) => variant.variantId).sort(),
    states: resolved.states.map((state) => state.code).sort(),
    cities: resolved.cities.map((city) => city.localityKey).sort(),
    blueprints: resolved.blueprints.map((blueprint) => ({
      pageBlueprintId: blueprint.pageBlueprintId,
      version: blueprint.version,
    })).sort((left, right) => left.pageBlueprintId.localeCompare(right.pageBlueprintId)),
  };
}

export function buildTargetMatrixPreview(input: {
  resolved: ResolvedOperatorTargetSelection;
  existingTargets?: readonly TargetInventoryRecord[];
  maximumTargets?: number;
  now?: string;
}): TargetMatrix {
  const cardinality = calculateTargetMatrixCardinality({ resolved: input.resolved, maximumTargets: input.maximumTargets });
  if (cardinality.overLimit) {
    throw new TargetPlanningError(
      "TARGET_MATRIX_LIMIT_EXCEEDED",
      `Estimated target count ${cardinality.theoreticalTargetCount} exceeds limit ${cardinality.limit}.`,
    );
  }
  const filters = [...input.resolved.filters];
  const expanded: TargetInventoryRecord[] = [];
  input.resolved.blueprints.forEach((blueprint) => {
    const products = blueprintProducts(blueprint, input.resolved, filters);
    const subjects = variantSubjects({ blueprint, products, variants: input.resolved.variants, filters });
    const geographies = blueprintGeographies(blueprint, input.resolved);
    validateRequiredSelection(blueprint, subjects, geographies);
    const requiresGeography = blueprint.requiredDimensions.some((dimension) =>
      dimension === "COUNTRY" || dimension === "STATE" || dimension === "CITY");
    subjects.forEach((subject) => {
      const combinations: readonly (TargetGeographyCandidate | null)[] = requiresGeography
        ? geographies
        : [null];
      combinations.forEach((geography) => {
        expanded.push(...expandTargetInventoryPreview({
          blueprint,
          subjects: [subject],
          geographies: geography ? [geography] : [],
          sourceProvenance: input.resolved.sourceProvenance,
          maximumTargets: cardinality.limit,
          now: input.now,
        }));
      });
    });
  });
  const deduplicated = deduplicateMatrixTargets(expanded);
  if (deduplicated.duplicateCount > 0) filters.push({
    reason: "DUPLICATE_TARGET",
    subjectId: input.resolved.selection.selectionId,
    details: `${deduplicated.duplicateCount} duplicate target combinations collapsed.`,
  });
  const targets = preserveExistingTargets(deduplicated.targets, input.existingTargets ?? []);
  const inventory = summarizeTargetInventory(targets);
  const blueprintById = new Map(input.resolved.blueprints.map((blueprint) => [blueprint.pageBlueprintId, blueprint]));
  const summary: TargetMatrixSummary = {
    selectedProductCount: input.resolved.products.length,
    selectedVariantCount: input.resolved.variants.length,
    selectedStateCount: input.resolved.states.length,
    selectedCityCount: new Set(input.resolved.cities.map((city) => city.localityKey)).size,
    blueprintCount: input.resolved.blueprints.length,
    theoreticalTargetCount: cardinality.theoreticalTargetCount,
    materializedBeforeDedupCount: expanded.length,
    deduplicatedTargetCount: targets.length,
    duplicateTargetCount: deduplicated.duplicateCount,
    filteredTargetCount: filters.filter((filter) => filter.reason !== "DUPLICATE_TARGET").length,
    filterReasonCounts: filterCounts(filters),
    inventory,
  };
  const semantic = {
    selection: semanticSelection(input.resolved),
    targets: targets.map((target) => target.targetId),
    cardinality,
    filters,
    publicationIntent: "draft",
  };
  const fingerprint = createCanonicalContentHash(semantic);
  return {
    matrixId: `target-matrix-${fingerprint.slice(0, 24)}`,
    selectionId: input.resolved.selection.selectionId,
    catalogAuthority: input.resolved.selection.catalogAuthority,
    catalogRevisionId: input.resolved.selection.catalogRevisionId,
    reconciliationPlanFingerprint: input.resolved.selection.reconciliationPlanFingerprint,
    blueprintVersions: Object.fromEntries(input.resolved.blueprints.map((blueprint) => [blueprint.pageBlueprintId, blueprint.version])),
    cardinality,
    targets,
    filters,
    summary,
    previewRows: targets.map((target) => ({
      targetId: target.targetId,
      blueprintKey: blueprintById.get(target.pageBlueprintId)?.key ?? target.pageBlueprintId,
      productFamilyId: target.subject.productFamilyId,
      productId: target.subject.productId,
      variantId: target.subject.variantId,
      stateCode: target.geography.stateCode,
      cityName: target.geography.cityName,
      applicationPath: target.applicationPath,
      canonicalPath: target.canonicalPath,
      targetState: target.targetState,
      eligibility: target.eligibility,
      catalogAuthority: target.sourceProvenance.catalogAuthority,
      publicationIntent: "draft",
    })),
    publicationIntent: "draft",
    fingerprint,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function materializeTargetMatrix(input: {
  resolved: ResolvedOperatorTargetSelection;
  maximumTargets?: number;
  now?: string;
}): MaterializedTargetMatrix {
  const existingTargets = listTargetInventoryRecords();
  const matrix = buildTargetMatrixPreview({ ...input, existingTargets });
  const persistence = upsertTargetInventoryBatch({
    targets: matrix.targets,
    expectedRepositoryRevision: getTargetInventoryRepositoryRevision(),
  });
  return { matrix, persistence };
}

export function listTargetMatrixTargets(
  matrix: TargetMatrix,
  filters: {
    pageBlueprintId?: string;
    productFamilyId?: string;
    productId?: string;
    stateCode?: string;
  } = {},
): readonly TargetInventoryRecord[] {
  return matrix.targets
    .filter((target) => !filters.pageBlueprintId || target.pageBlueprintId === filters.pageBlueprintId)
    .filter((target) => !filters.productFamilyId || target.subject.productFamilyId === filters.productFamilyId)
    .filter((target) => !filters.productId || target.subject.productId === filters.productId)
    .filter((target) => !filters.stateCode || target.geography.stateCode === filters.stateCode);
}

export function summarizeTargetMatrix(matrix: TargetMatrix): TargetMatrixSummary {
  return matrix.summary;
}