import type { GlwTargetPreflightResult } from "../glw/target-preflight";
import { createCanonicalContentHash } from "./canonical-content-hash";
import {
  createPageDimension,
  validatePageBlueprintDimensions,
  type CatalogPlanningAuthority,
  type PageBlueprint,
  type PageDimension,
  type PageDimensionType,
} from "./page-blueprint";

export type TargetState =
  | "PLANNED"
  | "ABSENT"
  | "EXISTS_DRAFT"
  | "EXISTS_PUBLISHED"
  | "UNKNOWN"
  | "BLOCKED"
  | "STALE"
  | "ARCHIVED"
  | "NEEDS_REFRESH";

export type TargetEligibility =
  | "ELIGIBLE_CREATE"
  | "ELIGIBLE_UPDATE"
  | "NOT_ELIGIBLE_PUBLISHED"
  | "NOT_ELIGIBLE_POLICY"
  | "NOT_ELIGIBLE_COLLISION"
  | "REVIEW_REQUIRED"
  | "UNKNOWN_REQUIRES_PREFLIGHT";

export type SelectionMode = "ONE" | "SELECTED" | "ALL_ELIGIBLE";

export type TargetSelection<T> = {
  mode: SelectionMode;
  values: readonly T[];
};

export type TargetSelectionScope = {
  products: TargetSelection<string>;
  variants: TargetSelection<string>;
  states: TargetSelection<string>;
  cities: TargetSelection<string>;
};

export type TargetIdentity = {
  siteId: string;
  pageBlueprintId: string;
  canonicalDimensions: readonly PageDimension[];
};

export type TargetSourceProvenance = {
  catalogAuthority: CatalogPlanningAuthority;
  catalogRevisionId: string | null;
  reconciliationPlanFingerprint: string | null;
  selectionSource: string;
};

export type TargetParentReferences = {
  canonicalProductParentId: string | null;
  canonicalStateParentId: string | null;
  canonicalTargetParentId: string | null;
};

export type TargetInventoryRecord = {
  targetId: string;
  pageIdentityId: string;
  organizationId: string;
  siteId: string;
  pageBlueprintId: string;
  blueprintVersion: number;
  identity: TargetIdentity;
  subject: {
    productFamilyId: string | null;
    productId: string | null;
    variantId: string | null;
    attributeDefinitionId: string | null;
    attributeValue: string | null;
  };
  geography: {
    countryCode: string | null;
    stateCode: string | null;
    cityName: string | null;
    cityKey: string | null;
  };
  canonicalDimensions: readonly PageDimension[];
  applicationPath: string;
  canonicalPath: string;
  canonicalSlug: string;
  parentReferences: TargetParentReferences;
  targetState: TargetState;
  eligibility: TargetEligibility;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
  wordpressUrl: string | null;
  sourceProvenance: TargetSourceProvenance;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TargetStaleness = {
  stale: boolean;
  reasons: readonly string[];
};

export const TARGET_EXPANSION_LIMITS = {
  maximumTargetsPerPreview: 100_000,
  maximumProductsPerSelection: 1_000,
  maximumGeographiesPerSelection: 10_000,
  maximumExpandedMatrixCardinality: 100_000,
} as const;

export class TargetPlanningError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TargetPlanningError";
    this.code = code;
  }
}

function dimensionIdentity(dimension: PageDimension): object {
  return {
    dimensionType: dimension.dimensionType,
    dimensionKey: dimension.dimensionKey,
    stableValue: dimension.stableValue,
  };
}

export function normalizeTargetDimensions(
  dimensions: readonly PageDimension[],
): readonly PageDimension[] {
  const byKey = new Map<string, PageDimension>();
  dimensions.forEach((dimension) => {
    const key = `${dimension.dimensionType}|${dimension.dimensionKey}`;
    const existing = byKey.get(key);
    if (existing && existing.stableValue !== dimension.stableValue) {
      throw new TargetPlanningError("DIMENSION_IDENTITY_CONFLICT", `Conflicting target dimension: ${key}`);
    }
    byKey.set(key, dimension);
  });
  return [...byKey.values()].sort((left, right) => {
    const leftKey = `${left.dimensionType}|${left.dimensionKey}|${left.stableValue}`;
    const rightKey = `${right.dimensionType}|${right.dimensionKey}|${right.stableValue}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function createTargetIdentity(input: {
  blueprint: PageBlueprint;
  dimensions: readonly PageDimension[];
}): TargetIdentity {
  const allowedTypes = new Set([...input.blueprint.requiredDimensions, ...input.blueprint.optionalDimensions]);
  const canonicalDimensions = normalizeTargetDimensions(
    input.dimensions.filter((dimension) => allowedTypes.has(dimension.dimensionType)),
  );
  const validation = validatePageBlueprintDimensions(input.blueprint, canonicalDimensions);
  if (!validation.valid) {
    throw new TargetPlanningError(
      "BLUEPRINT_DIMENSIONS_INVALID",
      `Invalid dimensions for ${input.blueprint.key}: missing=${validation.missingDimensions.join(",")}; prohibited=${validation.prohibitedDimensions.join(",")}`,
    );
  }
  return {
    siteId: input.blueprint.siteId,
    pageBlueprintId: input.blueprint.pageBlueprintId,
    canonicalDimensions,
  };
}

export function createTargetId(identity: TargetIdentity): string {
  return `target-${createCanonicalContentHash({
    siteId: identity.siteId,
    pageBlueprintId: identity.pageBlueprintId,
    dimensions: normalizeTargetDimensions(identity.canonicalDimensions).map(dimensionIdentity),
  }).slice(0, 32)}`;
}

export function createPageIdentityId(input: { siteId: string; canonicalPath: string }): string {
  return `page-${createCanonicalContentHash({
    siteId: input.siteId,
    canonicalPath: input.canonicalPath.trim().toLowerCase(),
  }).slice(0, 32)}`;
}

function dimensionValue(
  dimensions: readonly PageDimension[],
  type: PageDimensionType,
): string | null {
  return dimensions.find((dimension) => dimension.dimensionType === type)?.stableValue ?? null;
}

function normalizePath(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!normalized || !/^[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?$/.test(normalized)) {
    throw new TargetPlanningError("INVALID_TARGET_PATH", `Invalid target path: ${value}`);
  }
  return normalized;
}

function validateProvenance(provenance: TargetSourceProvenance): void {
  if (provenance.catalogAuthority === "CANONICAL_PERSISTED" && !provenance.catalogRevisionId) {
    throw new TargetPlanningError("CATALOG_PROVENANCE_REQUIRED", "Persisted catalog targets require a catalog revision reference.");
  }
  if (provenance.catalogAuthority === "CERTIFIED_RECONCILIATION_PLAN" && !provenance.reconciliationPlanFingerprint) {
    throw new TargetPlanningError("CATALOG_PROVENANCE_REQUIRED", "Reconciliation-plan targets require a plan fingerprint.");
  }
}

export function planTargetInventoryRecord(input: {
  blueprint: PageBlueprint;
  dimensions: readonly PageDimension[];
  applicationPath: string;
  canonicalPath: string;
  canonicalParentId?: string | null;
  parentReferences?: Partial<TargetParentReferences>;
  sourceProvenance: TargetSourceProvenance;
  now?: string;
}): TargetInventoryRecord {
  validateProvenance(input.sourceProvenance);
  const identity = createTargetIdentity({ blueprint: input.blueprint, dimensions: input.dimensions });
  const applicationPath = normalizePath(input.applicationPath);
  const canonicalPath = normalizePath(input.canonicalPath);
  const canonicalDimensions = identity.canonicalDimensions;
  const timestamp = input.now ?? new Date().toISOString();
  const city = canonicalDimensions.find((dimension) => dimension.dimensionType === "CITY");
  return {
    targetId: createTargetId(identity),
    pageIdentityId: createPageIdentityId({ siteId: input.blueprint.siteId, canonicalPath }),
    organizationId: input.blueprint.organizationId,
    siteId: input.blueprint.siteId,
    pageBlueprintId: input.blueprint.pageBlueprintId,
    blueprintVersion: input.blueprint.version,
    identity,
    subject: {
      productFamilyId: dimensionValue(canonicalDimensions, "PRODUCT_FAMILY"),
      productId: dimensionValue(canonicalDimensions, "PRODUCT"),
      variantId: dimensionValue(canonicalDimensions, "VARIANT"),
      attributeDefinitionId: dimensionValue(canonicalDimensions, "ATTRIBUTE"),
      attributeValue: dimensionValue(canonicalDimensions, "ATTRIBUTE_VALUE"),
    },
    geography: {
      countryCode: dimensionValue(canonicalDimensions, "COUNTRY"),
      stateCode: dimensionValue(canonicalDimensions, "STATE"),
      cityName: city?.displayValue ?? null,
      cityKey: city?.stableValue ?? null,
    },
    canonicalDimensions,
    applicationPath,
    canonicalPath,
    canonicalSlug: canonicalPath.split("/").at(-1) ?? canonicalPath,
    parentReferences: {
      canonicalProductParentId: input.parentReferences?.canonicalProductParentId ?? null,
      canonicalStateParentId: input.parentReferences?.canonicalStateParentId ?? null,
      canonicalTargetParentId: input.canonicalParentId ?? input.parentReferences?.canonicalTargetParentId ?? null,
    },
    targetState: "PLANNED",
    eligibility: "UNKNOWN_REQUIRES_PREFLIGHT",
    wordpressObjectId: null,
    wordpressStatus: null,
    wordpressUrl: null,
    sourceProvenance: input.sourceProvenance,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

export function projectGlwPreflightToTarget(
  target: TargetInventoryRecord,
  preflight: GlwTargetPreflightResult,
  now = new Date().toISOString(),
): TargetInventoryRecord {
  if (preflight.applicationPath !== target.applicationPath || preflight.canonicalPath !== target.canonicalPath) {
    throw new TargetPlanningError("PREFLIGHT_TARGET_MISMATCH", "Preflight paths do not exactly match the planned target.");
  }
  const eligibility: TargetEligibility = preflight.state === "ABSENT"
    ? "ELIGIBLE_CREATE"
    : preflight.state === "EXISTS_DRAFT"
      ? preflight.wordpressObjectId ? "ELIGIBLE_UPDATE" : "NOT_ELIGIBLE_COLLISION"
      : preflight.state === "EXISTS_PUBLISHED"
        ? "NOT_ELIGIBLE_PUBLISHED"
        : "UNKNOWN_REQUIRES_PREFLIGHT";
  return {
    ...target,
    targetState: preflight.state,
    eligibility,
    wordpressObjectId: preflight.wordpressObjectId,
    wordpressStatus: preflight.wordpressStatus,
    wordpressUrl: preflight.wordpressUrl,
    parentReferences: {
      ...target.parentReferences,
      canonicalTargetParentId: preflight.canonicalParentId,
    },
    updatedAt: now,
    version: target.version + 1,
  };
}

export function detectTargetStaleness(input: {
  target: TargetInventoryRecord;
  currentBlueprintVersion: number;
  currentCatalogRevisionId?: string | null;
  currentReconciliationPlanFingerprint?: string | null;
  currentCanonicalPath?: string;
}): TargetStaleness {
  const reasons: string[] = [];
  if (input.target.blueprintVersion !== input.currentBlueprintVersion) reasons.push("BLUEPRINT_VERSION_CHANGED");
  if (input.currentCatalogRevisionId !== undefined
    && input.target.sourceProvenance.catalogRevisionId !== input.currentCatalogRevisionId) reasons.push("CATALOG_REVISION_CHANGED");
  if (input.currentReconciliationPlanFingerprint !== undefined
    && input.target.sourceProvenance.reconciliationPlanFingerprint !== input.currentReconciliationPlanFingerprint) reasons.push("RECONCILIATION_PLAN_CHANGED");
  if (input.currentCanonicalPath !== undefined
    && input.target.canonicalPath !== normalizePath(input.currentCanonicalPath)) reasons.push("CANONICAL_PATH_CHANGED");
  return { stale: reasons.length > 0, reasons };
}

export type TargetSubjectCandidate = {
  productFamilyId: string | null;
  productId: string;
  variantId: string | null;
  applicationProductSlug: string;
  canonicalProductSlug: string;
};

export type TargetGeographyCandidate = {
  countryCode: string;
  stateCode: string | null;
  stateName: string | null;
  stateSlug: string | null;
  cityName: string | null;
  citySlug: string | null;
  localityKey: string | null;
};

export type TargetCardinalityEstimate = {
  productCount: number;
  variantMultiplier: number;
  geographyCount: number;
  theoreticalTargetCount: number;
  overLimit: boolean;
};

export function estimateTargetCardinality(input: {
  blueprint: PageBlueprint;
  productCount: number;
  variantCount?: number;
  geographyCount: number;
  maximumTargets?: number;
}): TargetCardinalityEstimate {
  const variantMultiplier = input.blueprint.requiredDimensions.includes("VARIANT")
    ? Math.max(input.variantCount ?? 0, 0)
    : 1;
  const theoreticalTargetCount = input.productCount * variantMultiplier * input.geographyCount;
  const maximumTargets = input.maximumTargets ?? TARGET_EXPANSION_LIMITS.maximumExpandedMatrixCardinality;
  return {
    productCount: input.productCount,
    variantMultiplier,
    geographyCount: input.geographyCount,
    theoreticalTargetCount,
    overLimit: theoreticalTargetCount > maximumTargets,
  };
}

function geographyDimensions(geography: TargetGeographyCandidate): PageDimension[] {
  const dimensions: PageDimension[] = [createPageDimension({
    dimensionType: "COUNTRY",
    dimensionKey: "country-code",
    stableValue: geography.countryCode.toUpperCase(),
    displayValue: geography.countryCode.toUpperCase(),
    normalizedValue: geography.countryCode.toUpperCase(),
  })];
  if (geography.stateCode) dimensions.push(createPageDimension({
    dimensionType: "STATE",
    dimensionKey: "state-code",
    stableValue: geography.stateCode.toUpperCase(),
    displayValue: geography.stateName ?? geography.stateCode,
    normalizedValue: geography.stateCode.toUpperCase(),
  }));
  if (geography.citySlug) dimensions.push(createPageDimension({
    dimensionType: "CITY",
    dimensionKey: "city-key",
    stableValue: geography.localityKey
      ?? `${geography.countryCode.toUpperCase()}|${geography.stateCode?.toUpperCase() ?? ""}|${geography.citySlug}`,
    displayValue: geography.cityName ?? geography.citySlug,
    normalizedValue: geography.citySlug,
  }));
  return dimensions;
}

function targetPaths(subject: TargetSubjectCandidate, geography: TargetGeographyCandidate | null): {
  applicationPath: string;
  canonicalPath: string;
} {
  const location = [geography?.stateSlug, geography?.citySlug].filter(Boolean);
  return {
    applicationPath: [subject.applicationProductSlug, ...location].join("/"),
    canonicalPath: [subject.canonicalProductSlug, ...location].join("/"),
  };
}

export function expandTargetInventoryPreview(input: {
  blueprint: PageBlueprint;
  subjects: readonly TargetSubjectCandidate[];
  geographies: readonly TargetGeographyCandidate[];
  sourceProvenance: TargetSourceProvenance;
  maximumTargets?: number;
  now?: string;
}): readonly TargetInventoryRecord[] {
  if (input.subjects.length > TARGET_EXPANSION_LIMITS.maximumProductsPerSelection) {
    throw new TargetPlanningError("PRODUCT_SELECTION_LIMIT_EXCEEDED", "Product selection exceeds the planning limit.");
  }
  if (input.geographies.length > TARGET_EXPANSION_LIMITS.maximumGeographiesPerSelection) {
    throw new TargetPlanningError("GEOGRAPHY_SELECTION_LIMIT_EXCEEDED", "Geography selection exceeds the planning limit.");
  }
  const requiresGeography = input.blueprint.requiredDimensions.some((dimension) =>
    dimension === "COUNTRY" || dimension === "STATE" || dimension === "CITY");
  const geographies: readonly (TargetGeographyCandidate | null)[] = requiresGeography
    ? input.geographies
    : [null];
  const estimate = estimateTargetCardinality({
    blueprint: input.blueprint,
    productCount: input.subjects.length,
    variantCount: input.blueprint.requiredDimensions.includes("VARIANT") ? 1 : undefined,
    geographyCount: geographies.length,
    maximumTargets: input.maximumTargets ?? TARGET_EXPANSION_LIMITS.maximumTargetsPerPreview,
  });
  if (estimate.overLimit) {
    throw new TargetPlanningError("TARGET_EXPANSION_LIMIT_EXCEEDED", "Target expansion exceeds the planning preview limit.");
  }

  const targets = new Map<string, TargetInventoryRecord>();
  input.subjects.forEach((subject) => geographies.forEach((geography) => {
    const dimensions: PageDimension[] = [
      createPageDimension({
        dimensionType: "SITE",
        dimensionKey: "site-id",
        stableValue: input.blueprint.siteId,
        displayValue: input.blueprint.siteId,
        normalizedValue: input.blueprint.siteId,
      }),
      createPageDimension({
        dimensionType: "PRODUCT",
        dimensionKey: "product-id",
        stableValue: subject.productId,
        displayValue: subject.productId,
        normalizedValue: subject.productId,
      }),
    ];
    if (subject.productFamilyId) dimensions.push(createPageDimension({
      dimensionType: "PRODUCT_FAMILY",
      dimensionKey: "product-family-id",
      stableValue: subject.productFamilyId,
      displayValue: subject.productFamilyId,
      normalizedValue: subject.productFamilyId,
    }));
    if (subject.variantId) dimensions.push(createPageDimension({
      dimensionType: "VARIANT",
      dimensionKey: "variant-id",
      stableValue: subject.variantId,
      displayValue: subject.variantId,
      normalizedValue: subject.variantId,
    }));
    if (geography) dimensions.push(...geographyDimensions(geography));
    const paths = targetPaths(subject, geography);
    const target = planTargetInventoryRecord({
      blueprint: input.blueprint,
      dimensions,
      ...paths,
      sourceProvenance: input.sourceProvenance,
      now: input.now,
    });
    const existing = targets.get(target.targetId);
    if (existing && createCanonicalContentHash(existing.identity) !== createCanonicalContentHash(target.identity)) {
      throw new TargetPlanningError("TARGET_ID_COLLISION", `Target ID collision: ${target.targetId}`);
    }
    targets.set(target.targetId, existing ?? target);
  }));
  return [...targets.values()].sort((left, right) => left.targetId.localeCompare(right.targetId));
}

export type TargetInventorySummary = {
  totalTargets: number;
  byProduct: Readonly<Record<string, number>>;
  byFamily: Readonly<Record<string, number>>;
  byState: Readonly<Record<string, number>>;
  byCity: Readonly<Record<string, number>>;
  byBlueprint: Readonly<Record<string, number>>;
  byStateStatus: Readonly<Record<TargetState, number>>;
  byEligibility: Readonly<Record<TargetEligibility, number>>;
};

function countBy(records: readonly TargetInventoryRecord[], value: (record: TargetInventoryRecord) => string | null): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    const key = value(record);
    if (key) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function summarizeTargetInventory(records: readonly TargetInventoryRecord[]): TargetInventorySummary {
  const targetStates: TargetState[] = ["PLANNED", "ABSENT", "EXISTS_DRAFT", "EXISTS_PUBLISHED", "UNKNOWN", "BLOCKED", "STALE", "ARCHIVED", "NEEDS_REFRESH"];
  const eligibilityStates: TargetEligibility[] = ["ELIGIBLE_CREATE", "ELIGIBLE_UPDATE", "NOT_ELIGIBLE_PUBLISHED", "NOT_ELIGIBLE_POLICY", "NOT_ELIGIBLE_COLLISION", "REVIEW_REQUIRED", "UNKNOWN_REQUIRES_PREFLIGHT"];
  return {
    totalTargets: records.length,
    byProduct: countBy(records, (record) => record.subject.productId),
    byFamily: countBy(records, (record) => record.subject.productFamilyId),
    byState: countBy(records, (record) => record.geography.stateCode),
    byCity: countBy(records, (record) => record.geography.cityKey),
    byBlueprint: countBy(records, (record) => record.pageBlueprintId),
    byStateStatus: Object.fromEntries(targetStates.map((state) => [state, records.filter((record) => record.targetState === state).length])) as Record<TargetState, number>,
    byEligibility: Object.fromEntries(eligibilityStates.map((state) => [state, records.filter((record) => record.eligibility === state).length])) as Record<TargetEligibility, number>,
  };
}