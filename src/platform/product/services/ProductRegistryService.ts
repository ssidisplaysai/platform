import { randomUUID } from "node:crypto";
import { assertLifecycleTransitionAllowed } from "../domain";
import {
  ProductError,
  type AssetReference,
  type AttributeDefinition,
  type BillOfMaterialDefinition,
  type Category,
  type Configuration,
  type DocumentReference,
  type KnowledgeReference,
  type LifecycleState,
  type OptionDefinition,
  type OrganizationReference,
  type PricingDefinition,
  type Product,
  type ProductActorContext,
  type ProductBundle,
  type ProductFamily,
  type ProductKit,
  type ProductRelationship,
  type ProductVariant,
  type ProductVersion,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeKey(input: string): string {
  return input.trim().toLowerCase();
}

export type ProductFoundationEntityKind =
  | "Product"
  | "ProductVariant"
  | "ProductFamily"
  | "Category"
  | "AttributeDefinition"
  | "OptionDefinition"
  | "Configuration"
  | "ProductRelationship"
  | "ProductBundle"
  | "ProductKit"
  | "ProductVersion"
  | "PricingDefinition"
  | "BillOfMaterialDefinition"
  | "AssetReference"
  | "DocumentReference"
  | "KnowledgeReference"
  | "OrganizationReference";

export class ProductRegistryService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  listProducts(tenantId?: string): Product[] {
    return this.persistence
      .snapshot()
      .products.filter((item) => (tenantId ? item.tenantId === tenantId : true))
      .map((item) => structuredClone(item));
  }

  async registerProduct(input: {
    tenantId: string;
    sku: string;
    displayName: string;
    productFamilyId: string;
    categoryId: string;
    actor: ProductActorContext;
  }): Promise<Product> {
    if (!input.tenantId || !input.sku || !input.displayName || !input.productFamilyId || !input.categoryId) {
      throw new ProductError("PRODUCT_INVALID", "missing required product registration fields", false, true, "HIGH");
    }

    const at = nowIso();
    const normalizedSku = normalizeKey(input.sku);
    const product: Product = {
      productId: `product_${randomUUID()}`,
      tenantId: input.tenantId,
      sku: normalizedSku,
      displayName: input.displayName.trim(),
      productFamilyId: input.productFamilyId,
      categoryId: input.categoryId,
      lifecycleState: "DRAFT",
      attributes: [],
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const exists = state.products.some((item) => item.tenantId === product.tenantId && item.sku === product.sku);
      if (exists) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate sku in tenant scope: ${product.sku}`, false, true, "HIGH");
      }
      state.products.push(product);
    });

    await this.audit.append({
      eventType: "PRODUCT_REGISTERED",
      tenantId: product.tenantId,
      productId: product.productId,
      actor: input.actor,
      message: `product ${product.productId} registered`,
      details: { sku: product.sku },
    });

    return this.requireProduct(product.productId);
  }

  async transitionProductLifecycle(input: {
    tenantId: string;
    productId: string;
    lifecycleState: LifecycleState;
    expectedCurrentVersion: number;
    actor: ProductActorContext;
  }): Promise<Product> {
    await this.persistence.mutate((state) => {
      const product = state.products.find((item) => item.productId === input.productId);
      if (!product) {
        throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
      }
      if (product.tenantId !== input.tenantId) {
        throw new ProductError("TENANT_MISMATCH", `tenant mismatch for product ${input.productId}`, false, true, "HIGH");
      }

      const latestVersion = state.productVersions
        .filter((item) => item.productId === product.productId)
        .reduce((max, current) => (current.versionNumber > max ? current.versionNumber : max), 0);

      if (latestVersion !== input.expectedCurrentVersion) {
        state.metrics.versionConflictCount += 1;
        throw new ProductError("VERSION_CONFLICT", `expected version ${input.expectedCurrentVersion} but found ${latestVersion}`, false, true, "HIGH");
      }

      assertLifecycleTransitionAllowed(product.lifecycleState, input.lifecycleState);
      product.lifecycleState = input.lifecycleState;
      product.updatedAt = nowIso();
      product.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "PRODUCT_LIFECYCLE_TRANSITIONED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `product lifecycle transitioned to ${input.lifecycleState}`,
      details: { lifecycleState: input.lifecycleState },
    });

    return this.requireProduct(input.productId);
  }

  async registerFoundationEntities(input: {
    tenantId: string;
    actor: ProductActorContext;
    entities: {
      productFamilies?: ProductFamily[];
      categories?: Category[];
      attributeDefinitions?: AttributeDefinition[];
      optionDefinitions?: OptionDefinition[];
      variants?: ProductVariant[];
      configurations?: Configuration[];
      productRelationships?: ProductRelationship[];
      productBundles?: ProductBundle[];
      productKits?: ProductKit[];
      productVersions?: ProductVersion[];
      pricingDefinitions?: PricingDefinition[];
      billOfMaterialDefinitions?: BillOfMaterialDefinition[];
      assetReferences?: AssetReference[];
      documentReferences?: DocumentReference[];
      knowledgeReferences?: KnowledgeReference[];
      organizationReferences?: OrganizationReference[];
      nonFoundationKinds?: string[];
    };
  }): Promise<void> {
    const invalidKinds = input.entities.nonFoundationKinds ?? [];
    if (invalidKinds.length > 0) {
      throw new ProductError(
        "BOUNDARY_VIOLATION",
        `non-foundation entities are not supported: ${invalidKinds.join(",")}`,
        false,
        true,
        "CRITICAL",
      );
    }

    await this.persistence.mutate((state) => {
      state.productFamilies.push(...(input.entities.productFamilies ?? []));
      state.categories.push(...(input.entities.categories ?? []));
      state.attributeDefinitions.push(...(input.entities.attributeDefinitions ?? []));
      state.optionDefinitions.push(...(input.entities.optionDefinitions ?? []));
      state.variants.push(...(input.entities.variants ?? []));
      state.configurations.push(...(input.entities.configurations ?? []));
      state.productRelationships.push(...(input.entities.productRelationships ?? []));
      state.productBundles.push(...(input.entities.productBundles ?? []));
      state.productKits.push(...(input.entities.productKits ?? []));
      state.productVersions.push(...(input.entities.productVersions ?? []));
      state.pricingDefinitions.push(...(input.entities.pricingDefinitions ?? []));
      state.billOfMaterialDefinitions.push(...(input.entities.billOfMaterialDefinitions ?? []));
      state.assetReferences.push(...(input.entities.assetReferences ?? []));
      state.documentReferences.push(...(input.entities.documentReferences ?? []));
      state.knowledgeReferences.push(...(input.entities.knowledgeReferences ?? []));
      state.organizationReferences.push(...(input.entities.organizationReferences ?? []));
    });

    await this.audit.append({
      eventType: "PRODUCT_FOUNDATION_ENTITIES_REGISTERED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: "foundation entities registered",
      details: {
        productFamilies: input.entities.productFamilies?.length ?? 0,
        categories: input.entities.categories?.length ?? 0,
        attributes: input.entities.attributeDefinitions?.length ?? 0,
      },
    });
  }

  async registerReferences(input: {
    tenantId: string;
    productId: string;
    assetReferences?: AssetReference[];
    documentReferences?: DocumentReference[];
    knowledgeReferences?: KnowledgeReference[];
    organizationReferences?: OrganizationReference[];
    actor: ProductActorContext;
  }): Promise<void> {
    await this.persistence.mutate((state) => {
      const product = state.products.find((item) => item.productId === input.productId);
      if (!product) {
        throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
      }
      if (product.tenantId !== input.tenantId) {
        throw new ProductError("TENANT_MISMATCH", `tenant mismatch for product ${input.productId}`, false, true, "HIGH");
      }

      for (const reference of input.assetReferences ?? []) {
        if (!reference.assetId) {
          state.metrics.invalidReferenceCount += 1;
          throw new ProductError("REFERENCE_INVALID", "asset reference id is required", false, true, "HIGH");
        }
        state.assetReferences.push(reference);
      }

      for (const reference of input.documentReferences ?? []) {
        if (!reference.documentId) {
          state.metrics.invalidReferenceCount += 1;
          throw new ProductError("REFERENCE_INVALID", "document reference id is required", false, true, "HIGH");
        }
        state.documentReferences.push(reference);
      }

      for (const reference of input.knowledgeReferences ?? []) {
        if (!reference.knowledgeId) {
          state.metrics.invalidReferenceCount += 1;
          throw new ProductError("REFERENCE_INVALID", "knowledge reference id is required", false, true, "HIGH");
        }
        state.knowledgeReferences.push(reference);
      }

      for (const reference of input.organizationReferences ?? []) {
        if (!reference.organizationId) {
          state.metrics.invalidReferenceCount += 1;
          throw new ProductError("REFERENCE_INVALID", "organization reference id is required", false, true, "HIGH");
        }
        state.organizationReferences.push(reference);
      }
    });

    await this.audit.append({
      eventType: "PRODUCT_REFERENCES_REGISTERED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: "product references registered",
    });
  }

  private requireProduct(productId: string): Product {
    const found = this.persistence.snapshot().products.find((item) => item.productId === productId);
    if (!found) {
      throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${productId}`, false, true, "MEDIUM");
    }
    return structuredClone(found);
  }
}
