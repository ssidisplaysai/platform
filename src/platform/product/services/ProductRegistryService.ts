import {
  ProductError,
  type AssetReference,
  type AttributeDefinition,
  type BillOfMaterialDefinition,
  type Category,
  type Configuration,
  type DocumentReference,
  type KnowledgeReference,
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
import { ProductBomDefinitionService } from "./ProductBomDefinitionService";
import { ProductBundleKitService } from "./ProductBundleKitService";
import { ProductCatalogService } from "./ProductCatalogService";
import { ProductConfigurationService } from "./ProductConfigurationService";
import { ProductPricingDefinitionService } from "./ProductPricingDefinitionService";
import { ProductQueryService } from "./ProductQueryService";
import { ProductReferenceRegistryService } from "./ProductReferenceRegistryService";
import { ProductRelationshipService } from "./ProductRelationshipService";
import { ProductVariantService } from "./ProductVariantService";

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
  readonly catalog: ProductCatalogService;
  readonly variant: ProductVariantService;
  readonly configuration: ProductConfigurationService;
  readonly pricingDefinition: ProductPricingDefinitionService;
  readonly bomDefinition: ProductBomDefinitionService;
  readonly relationship: ProductRelationshipService;
  readonly bundleKit: ProductBundleKitService;
  readonly references: ProductReferenceRegistryService;
  readonly query: ProductQueryService;

  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {
    this.catalog = new ProductCatalogService(this.persistence, this.audit);
    this.variant = new ProductVariantService(this.persistence, this.audit);
    this.configuration = new ProductConfigurationService(this.persistence, this.audit);
    this.pricingDefinition = new ProductPricingDefinitionService(this.persistence, this.audit);
    this.bomDefinition = new ProductBomDefinitionService(this.persistence, this.audit);
    this.relationship = new ProductRelationshipService(this.persistence, this.audit);
    this.bundleKit = new ProductBundleKitService(this.persistence, this.audit);
    this.references = new ProductReferenceRegistryService(this.persistence, this.audit);
    this.query = new ProductQueryService(this.persistence);
  }

  listProducts(tenantId?: string): Product[] {
    return this.query.listProducts(tenantId);
  }

  async registerProduct(input: {
    tenantId: string;
    productId: string;
    productCode: string;
    versionIdentifier: string;
    displayName: string;
    lifecycleState: Product["lifecycleState"];
    metadata: Product["metadata"];
    productFamilyId: string;
    categoryId: string;
    actor: ProductActorContext;
  }): Promise<Product> {
    return this.catalog.createProduct(input);
  }

  async transitionProductLifecycle(input: {
    tenantId: string;
    productId: string;
    lifecycleState: Product["lifecycleState"];
    expectedVersionIdentifier: string;
    actor: ProductActorContext;
    reason?: string;
  }): Promise<Product> {
    return this.catalog.transitionLifecycle({
      tenantId: input.tenantId,
      productId: input.productId,
      nextLifecycleState: input.lifecycleState,
      expectedVersionIdentifier: input.expectedVersionIdentifier,
      actor: input.actor,
      reason: input.reason,
    });
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
      state.productVersions.push(...(input.entities.productVersions ?? []));
    });

    for (const variant of input.entities.variants ?? []) {
      await this.variant.createVariant({ ...variant, actor: input.actor });
    }

    for (const configuration of input.entities.configurations ?? []) {
      await this.configuration.defineConfiguration({ ...configuration, actor: input.actor });
    }

    for (const pricing of input.entities.pricingDefinitions ?? []) {
      await this.pricingDefinition.definePricing({ ...pricing, actor: input.actor });
    }

    for (const bom of input.entities.billOfMaterialDefinitions ?? []) {
      await this.bomDefinition.defineBom({ ...bom, actor: input.actor });
    }

    for (const relationship of input.entities.productRelationships ?? []) {
      await this.relationship.defineRelationship({ ...relationship, actor: input.actor });
    }

    for (const bundle of input.entities.productBundles ?? []) {
      await this.bundleKit.defineBundle({ ...bundle, actor: input.actor });
    }

    for (const kit of input.entities.productKits ?? []) {
      await this.bundleKit.defineKit({ ...kit, actor: input.actor });
    }

    // Apply initial references directly for each product to keep service boundaries explicit.
    const referenceGroups = [
      ...(input.entities.assetReferences ?? []),
      ...(input.entities.documentReferences ?? []),
      ...(input.entities.knowledgeReferences ?? []),
      ...(input.entities.organizationReferences ?? []),
    ];

    const groupedProductIds = [...new Set(referenceGroups.map((item) => item.productId))];
    for (const productId of groupedProductIds) {
      await this.references.registerReferences({
        tenantId: input.tenantId,
        productId,
        actor: input.actor,
        assetReferences: (input.entities.assetReferences ?? []).filter((item) => item.productId === productId),
        documentReferences: (input.entities.documentReferences ?? []).filter((item) => item.productId === productId),
        knowledgeReferences: (input.entities.knowledgeReferences ?? []).filter((item) => item.productId === productId),
        organizationReferences: (input.entities.organizationReferences ?? []).filter((item) => item.productId === productId),
      });
    }

    await this.audit.append({
      eventType: "PRODUCT_FOUNDATION_ENTITIES_REGISTERED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: "foundation entities registered",
      details: {
        productFamilies: input.entities.productFamilies?.length ?? 0,
        categories: input.entities.categories?.length ?? 0,
        variants: input.entities.variants?.length ?? 0,
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
    return this.references.registerReferences(input);
  }
}
