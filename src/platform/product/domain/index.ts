import {
  ProductError,
  isLifecycleState,
  type LifecycleState,
  type ProductPersistedState,
} from "../contracts";
import {
  assertBomGraphAcyclic,
  assertConfigurationGraphsAcyclic,
  assertReplacementGraphAcyclic,
} from "./cycleValidation";

const allowedLifecycleTransitions: Record<LifecycleState, readonly LifecycleState[]> = {
  DRAFT: ["PROPOSED", "ARCHIVED"],
  PROPOSED: ["APPROVED", "ARCHIVED"],
  APPROVED: ["ACTIVE", "DEPRECATED"],
  ACTIVE: ["DEPRECATED"],
  DEPRECATED: ["RETIRED"],
  RETIRED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertLifecycleTransitionAllowed(current: LifecycleState, next: LifecycleState): void {
  if (current === next) {
    return;
  }

  const allowed = allowedLifecycleTransitions[current];
  if (!allowed.includes(next)) {
    throw new ProductError(
      "LIFECYCLE_TRANSITION_INVALID",
      `lifecycle transition not allowed: ${current} -> ${next}`,
      false,
      true,
      "HIGH",
    );
  }
}

function assertLifecycleStateValid(state: LifecycleState, context: string): void {
  if (!isLifecycleState(state)) {
    throw new ProductError("LIFECYCLE_STATE_INVALID", `invalid lifecycle state in ${context}`, false, true, "CRITICAL");
  }
}

export function enforceDomainInvariants(state: ProductPersistedState): void {
  for (const product of state.products) {
    assertLifecycleStateValid(product.lifecycleState, `product ${product.productId}`);
  }

  for (const variant of state.variants) {
    assertLifecycleStateValid(variant.lifecycleState, `variant ${variant.productVariantId}`);
  }

  for (const configuration of state.configurations) {
    assertLifecycleStateValid(configuration.lifecycleState, `configuration ${configuration.configurationId}`);
  }

  for (const relationship of state.productRelationships) {
    if (relationship.lifecycleState) {
      assertLifecycleStateValid(relationship.lifecycleState, `relationship ${relationship.productRelationshipId}`);
    }
  }

  for (const bundle of state.productBundles) {
    assertLifecycleStateValid(bundle.lifecycleState, `bundle ${bundle.productBundleId}`);
  }

  for (const kit of state.productKits) {
    assertLifecycleStateValid(kit.lifecycleState, `kit ${kit.productKitId}`);
  }

  for (const pricing of state.pricingDefinitions) {
    assertLifecycleStateValid(pricing.lifecycleState, `pricing ${pricing.pricingDefinitionId}`);
  }

  for (const bom of state.billOfMaterialDefinitions) {
    assertLifecycleStateValid(bom.lifecycleState, `bom ${bom.billOfMaterialDefinitionId}`);
  }

  for (const version of state.productVersions) {
    assertLifecycleStateValid(version.lifecycleState, `product version ${version.productVersionId}`);
  }

  assertBomGraphAcyclic(state);
  assertConfigurationGraphsAcyclic(state);
  assertReplacementGraphAcyclic(state);
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

export * from "./cycleValidation";
