import { ProductError, type LifecycleState, type ProductPersistedState } from "../contracts";

const lifecycleOrder: Record<LifecycleState, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  DEPRECATED: 2,
  RETIRED: 3,
};

export function assertLifecycleTransitionAllowed(current: LifecycleState, next: LifecycleState): void {
  if (current === "RETIRED" && next !== "RETIRED") {
    throw new ProductError(
      "LIFECYCLE_TRANSITION_INVALID",
      "retired product cannot transition to another lifecycle state",
      false,
      true,
      "HIGH",
    );
  }

  if (lifecycleOrder[next] < lifecycleOrder[current]) {
    throw new ProductError(
      "LIFECYCLE_TRANSITION_INVALID",
      `lifecycle cannot move backward: ${current} -> ${next}`,
      false,
      true,
      "HIGH",
    );
  }
}

export function enforceDeterministicOrdering(state: ProductPersistedState): void {
  state.products.sort((a, b) => a.productId.localeCompare(b.productId));
  state.variants.sort((a, b) => a.productVariantId.localeCompare(b.productVariantId));
  state.productFamilies.sort((a, b) => a.productFamilyId.localeCompare(b.productFamilyId));
  state.categories.sort((a, b) => a.categoryId.localeCompare(b.categoryId));
  state.attributeDefinitions.sort((a, b) => a.attributeDefinitionId.localeCompare(b.attributeDefinitionId));
  state.optionDefinitions.sort((a, b) => a.optionDefinitionId.localeCompare(b.optionDefinitionId));
  state.configurations.sort((a, b) => a.configurationId.localeCompare(b.configurationId));
  state.productRelationships.sort((a, b) => a.productRelationshipId.localeCompare(b.productRelationshipId));
  state.productBundles.sort((a, b) => a.productBundleId.localeCompare(b.productBundleId));
  state.productKits.sort((a, b) => a.productKitId.localeCompare(b.productKitId));
  state.productVersions.sort((a, b) => a.productVersionId.localeCompare(b.productVersionId));
  state.pricingDefinitions.sort((a, b) => a.pricingDefinitionId.localeCompare(b.pricingDefinitionId));
  state.billOfMaterialDefinitions.sort((a, b) =>
    a.billOfMaterialDefinitionId.localeCompare(b.billOfMaterialDefinitionId),
  );
  state.assetReferences.sort((a, b) => a.referenceId.localeCompare(b.referenceId));
  state.documentReferences.sort((a, b) => a.referenceId.localeCompare(b.referenceId));
  state.knowledgeReferences.sort((a, b) => a.referenceId.localeCompare(b.referenceId));
  state.organizationReferences.sort((a, b) => a.referenceId.localeCompare(b.referenceId));
  state.audits.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
