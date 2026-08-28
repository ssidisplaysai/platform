import { GLW_CITIES, GLW_STATES } from "../glw/page-generation";
import type { CanonicalProduct } from "./canonical-catalog";
import type { CatalogReconciliationPlan } from "./catalog-reconciliation-plan";
import type { CatalogPlanningAuthority, PageBlueprint } from "./page-blueprint";
import type {
  SelectionMode,
  TargetGeographyCandidate,
  TargetSelection,
  TargetSourceProvenance,
  TargetSubjectCandidate,
} from "./target-inventory";

export type CitySelectionMode = SelectionMode | "ALL_ELIGIBLE_IN_SELECTED_STATES";

export type CitySelectionValue = {
  stateCode: string;
  citySlug: string;
};

export type OperatorTargetSelection = {
  selectionId: string;
  organizationId: string;
  siteId: string;
  pageBlueprintIds: readonly string[];
  productSelection: TargetSelection<string>;
  variantSelection: TargetSelection<string>;
  stateSelection: TargetSelection<string>;
  citySelection: {
    mode: CitySelectionMode;
    values: readonly CitySelectionValue[];
  };
  attributeSelection?: TargetSelection<string>;
  applicationSelection?: TargetSelection<string>;
  catalogAuthority: CatalogPlanningAuthority;
  catalogRevisionId: string | null;
  reconciliationPlanFingerprint: string | null;
  createdBy: string;
  createdAt: string;
  selectionSource: string;
  notes: string | null;
};

export type ProductPlanningCandidate = TargetSubjectCandidate & {
  organizationId: string;
  siteIds: readonly string[];
  eligible: boolean;
  reviewRequired: boolean;
  sourceAuthority: CatalogPlanningAuthority;
};

export type VariantPlanningCandidate = {
  variantId: string;
  productId: string;
  eligible: boolean;
  pageWorthy: boolean;
  reviewRequired: boolean;
  sourceAuthority: CatalogPlanningAuthority;
};

export type TargetSelectionFilterReason =
  | "PRODUCT_NOT_ELIGIBLE"
  | "PRODUCT_REVIEW_REQUIRED"
  | "FAMILY_NOT_ELIGIBLE"
  | "BLUEPRINT_NOT_ALLOWED"
  | "VARIANT_NOT_PAGE_WORTHY"
  | "ATTRIBUTE_NOT_PAGE_WORTHY"
  | "GEOGRAPHY_NOT_ELIGIBLE"
  | "MISSING_REQUIRED_DIMENSION"
  | "TARGET_LIMIT_EXCEEDED"
  | "DUPLICATE_TARGET";

export type TargetSelectionFilter = {
  reason: TargetSelectionFilterReason;
  subjectId: string;
  details: string;
};

export type ResolvedOperatorTargetSelection = {
  selection: OperatorTargetSelection;
  blueprints: readonly PageBlueprint[];
  products: readonly ProductPlanningCandidate[];
  variants: readonly VariantPlanningCandidate[];
  states: readonly { code: string; name: string; slug: string }[];
  cities: readonly TargetGeographyCandidate[];
  filters: readonly TargetSelectionFilter[];
  sourceProvenance: TargetSourceProvenance;
};

export class TargetSelectionResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TargetSelectionResolutionError";
    this.code = code;
  }
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function requireExplicitSelection(name: string, mode: SelectionMode, values: readonly string[]): void {
  if (mode === "ONE" && unique(values).length !== 1) {
    throw new TargetSelectionResolutionError("INVALID_SELECTION", `${name} ONE selection requires exactly one ID.`);
  }
  if (mode === "SELECTED" && values.length === 0) {
    throw new TargetSelectionResolutionError("INVALID_SELECTION", `${name} SELECTED selection requires IDs.`);
  }
}

function exactSelection<T>(input: {
  name: string;
  selection: TargetSelection<string>;
  candidates: readonly T[];
  id: (candidate: T) => string;
  unknownCode: string;
}): readonly T[] {
  requireExplicitSelection(input.name, input.selection.mode, input.selection.values);
  if (input.selection.mode === "ALL_ELIGIBLE") return input.candidates;
  const ids = unique(input.selection.values);
  const byId = new Map(input.candidates.map((candidate) => [input.id(candidate), candidate]));
  const unknown = ids.find((id) => !byId.has(id));
  if (unknown) throw new TargetSelectionResolutionError(input.unknownCode, `Unknown ${input.name} ID: ${unknown}`);
  return ids.map((id) => byId.get(id)!);
}

function resolveProducts(input: {
  selection: OperatorTargetSelection;
  candidates: readonly ProductPlanningCandidate[];
}): { products: readonly ProductPlanningCandidate[]; filters: readonly TargetSelectionFilter[] } {
  if (input.candidates.some((candidate) => candidate.sourceAuthority !== input.selection.catalogAuthority)) {
    throw new TargetSelectionResolutionError("MIXED_CATALOG_AUTHORITIES", "A selection cannot mix catalog authorities.");
  }
  const selected = exactSelection({
    name: "product",
    selection: input.selection.productSelection,
    candidates: input.candidates,
    id: (candidate) => candidate.productId,
    unknownCode: "UNKNOWN_PRODUCT",
  });
  const filters: TargetSelectionFilter[] = [];
  const products = selected.filter((candidate) => {
    if (candidate.organizationId !== input.selection.organizationId
      || !candidate.siteIds.includes(input.selection.siteId)
      || !candidate.eligible) {
      filters.push({ reason: "PRODUCT_NOT_ELIGIBLE", subjectId: candidate.productId, details: "Product is inactive, disabled, or not assigned to the selected site." });
      return false;
    }
    if (candidate.reviewRequired) {
      filters.push({ reason: "PRODUCT_REVIEW_REQUIRED", subjectId: candidate.productId, details: "Product requires catalog review." });
      return false;
    }
    return true;
  });
  return { products, filters };
}

function resolveVariants(input: {
  selection: OperatorTargetSelection;
  candidates: readonly VariantPlanningCandidate[];
  productIds: ReadonlySet<string>;
}): { variants: readonly VariantPlanningCandidate[]; filters: readonly TargetSelectionFilter[] } {
  if (input.candidates.some((candidate) => candidate.sourceAuthority !== input.selection.catalogAuthority)) {
    throw new TargetSelectionResolutionError("MIXED_CATALOG_AUTHORITIES", "A selection cannot mix catalog authorities.");
  }
  const selected = exactSelection({
    name: "variant",
    selection: input.selection.variantSelection,
    candidates: input.candidates,
    id: (candidate) => candidate.variantId,
    unknownCode: "UNKNOWN_VARIANT",
  });
  const filters: TargetSelectionFilter[] = [];
  const variants = selected.filter((candidate) => {
    if (!input.productIds.has(candidate.productId) || !candidate.eligible || candidate.reviewRequired || !candidate.pageWorthy) {
      filters.push({ reason: "VARIANT_NOT_PAGE_WORTHY", subjectId: candidate.variantId, details: "Variant is not eligible for standalone page planning." });
      return false;
    }
    return true;
  });
  return { variants, filters };
}

function resolveStates(selection: TargetSelection<string>): readonly { code: string; name: string; slug: string }[] {
  const states = exactSelection({
    name: "state",
    selection,
    candidates: GLW_STATES,
    id: (state) => state.code,
    unknownCode: "UNKNOWN_STATE",
  });
  return [...states].sort((left, right) => left.code.localeCompare(right.code));
}

function geography(stateCode: string, citySlug: string): TargetGeographyCandidate {
  const state = GLW_STATES.find((candidate) => candidate.code === stateCode);
  const city = GLW_CITIES.find((candidate) => candidate.stateCode === stateCode && candidate.slug === citySlug);
  if (!state || !city) {
    throw new TargetSelectionResolutionError(
      "CROSS_STATE_CITY_SELECTION",
      `City ${citySlug} does not belong to state ${stateCode}.`,
    );
  }
  return {
    countryCode: "US",
    stateCode: state.code,
    stateName: state.name,
    stateSlug: state.slug,
    cityName: city.name,
    citySlug: city.slug,
    localityKey: `US|${state.code}|${city.slug}`,
  };
}

function resolveCities(input: {
  selection: OperatorTargetSelection["citySelection"];
  states: readonly { code: string }[];
}): readonly TargetGeographyCandidate[] {
  const stateCodes = new Set(input.states.map((state) => state.code));
  const explicit = input.selection.values.map((value) => {
    if (!stateCodes.has(value.stateCode)) {
      throw new TargetSelectionResolutionError("CROSS_STATE_CITY_SELECTION", `City state ${value.stateCode} is outside the selected states.`);
    }
    return geography(value.stateCode, value.citySlug);
  });
  const includeAll = input.selection.mode === "ALL_ELIGIBLE"
    || input.selection.mode === "ALL_ELIGIBLE_IN_SELECTED_STATES";
  const allStateCities = includeAll
    ? GLW_CITIES.filter((city) => stateCodes.has(city.stateCode)).map((city) => geography(city.stateCode, city.slug))
    : [];
  if (input.selection.mode === "ONE" && explicit.length !== 1) {
    throw new TargetSelectionResolutionError("INVALID_SELECTION", "City ONE selection requires exactly one city.");
  }
  if (input.selection.mode === "SELECTED" && explicit.length === 0) {
    throw new TargetSelectionResolutionError("INVALID_SELECTION", "City SELECTED selection requires cities.");
  }
  return [...explicit, ...allStateCities].sort((left, right) =>
    `${left.stateCode}|${left.citySlug}`.localeCompare(`${right.stateCode}|${right.citySlug}`));
}

export function resolveOperatorTargetSelection(input: {
  selection: OperatorTargetSelection;
  blueprints: readonly PageBlueprint[];
  products: readonly ProductPlanningCandidate[];
  variants: readonly VariantPlanningCandidate[];
}): ResolvedOperatorTargetSelection {
  if (input.selection.pageBlueprintIds.length === 0) {
    throw new TargetSelectionResolutionError("BLUEPRINT_SELECTION_REQUIRED", "Select at least one page blueprint explicitly.");
  }
  const blueprints = exactSelection({
    name: "blueprint",
    selection: { mode: "SELECTED", values: input.selection.pageBlueprintIds },
    candidates: input.blueprints.filter((blueprint) => blueprint.status === "ACTIVE"),
    id: (blueprint) => blueprint.pageBlueprintId,
    unknownCode: "UNKNOWN_BLUEPRINT",
  });
  if (blueprints.some((blueprint) => blueprint.organizationId !== input.selection.organizationId
    || blueprint.siteId !== input.selection.siteId)) {
    throw new TargetSelectionResolutionError("BLUEPRINT_NOT_ALLOWED", "Blueprint is not assigned to the selected organization and site.");
  }
  const productResolution = resolveProducts({ selection: input.selection, candidates: input.products });
  const variantResolution = resolveVariants({
    selection: input.selection,
    candidates: input.variants,
    productIds: new Set(productResolution.products.map((product) => product.productId)),
  });
  const states = resolveStates(input.selection.stateSelection);
  const cities = resolveCities({ selection: input.selection.citySelection, states });
  const sourceProvenance: TargetSourceProvenance = {
    catalogAuthority: input.selection.catalogAuthority,
    catalogRevisionId: input.selection.catalogRevisionId,
    reconciliationPlanFingerprint: input.selection.reconciliationPlanFingerprint,
    selectionSource: input.selection.selectionSource,
  };
  return {
    selection: input.selection,
    blueprints,
    products: productResolution.products,
    variants: variantResolution.variants,
    states,
    cities,
    filters: [...productResolution.filters, ...variantResolution.filters],
    sourceProvenance,
  };
}

export function canonicalProductsToPlanningCandidates(input: {
  products: readonly CanonicalProduct[];
  canonicalSlugByProductId: Readonly<Record<string, string>>;
}): readonly ProductPlanningCandidate[] {
  return input.products.map((product) => ({
    productFamilyId: product.productFamilyId,
    productId: product.productId,
    variantId: null,
    applicationProductSlug: product.slug,
    canonicalProductSlug: input.canonicalSlugByProductId[product.productId] ?? product.slug,
    organizationId: product.organizationId,
    siteIds: product.assignedSiteIds,
    eligible: product.enabled && product.lifecycleState === "active",
    reviewRequired: false,
    sourceAuthority: "CANONICAL_PERSISTED",
  }));
}

export function reconciliationPlanToPlanningCandidates(input: {
  plan: CatalogReconciliationPlan;
  organizationId: string;
  siteId: string;
  applicationSlugByProductId: Readonly<Record<string, string>>;
  canonicalSlugByProductId: Readonly<Record<string, string>>;
}): readonly ProductPlanningCandidate[] {
  return input.plan.productDecisions.map((decision) => {
    const productId = decision.existingProductId ?? decision.candidateProductId;
    if (!productId) throw new TargetSelectionResolutionError("MISSING_PRODUCT_ID", `Decision ${decision.decisionId} has no stable product ID.`);
    const applicationProductSlug = input.applicationSlugByProductId[productId];
    const canonicalProductSlug = input.canonicalSlugByProductId[productId];
    if (!applicationProductSlug || !canonicalProductSlug) {
      throw new TargetSelectionResolutionError("MISSING_PATH_AUTHORITY", `Product ${productId} requires explicit application and canonical path slugs.`);
    }
    return {
      productFamilyId: decision.familyId,
      productId,
      variantId: null,
      applicationProductSlug,
      canonicalProductSlug,
      organizationId: input.organizationId,
      siteIds: [input.siteId],
      eligible: decision.readiness === "READY",
      reviewRequired: decision.reviewRequired,
      sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN" as const,
    };
  });
}

export function reconciliationPlanToVariantCandidates(
  plan: CatalogReconciliationPlan,
): readonly VariantPlanningCandidate[] {
  return plan.variantDecisions.map((decision) => {
    const productId = decision.existingProductId ?? decision.candidateProductId;
    if (!productId || !decision.candidateVariantId) {
      throw new TargetSelectionResolutionError("MISSING_VARIANT_ID", `Decision ${decision.decisionId} lacks stable product or variant identity.`);
    }
    return {
      variantId: decision.candidateVariantId,
      productId,
      eligible: decision.readiness === "READY",
      pageWorthy: false,
      reviewRequired: decision.reviewRequired,
      sourceAuthority: "CERTIFIED_RECONCILIATION_PLAN",
    };
  });
}