import {
  ProductError,
  type AssetReference,
  type DocumentReference,
  type KnowledgeReference,
  type OrganizationReference,
  type ProductActorContext,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

export class ProductReferenceRegistryService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async registerReferences(input: {
    tenantId: string;
    productId: string;
    actor: ProductActorContext;
    assetReferences?: AssetReference[];
    documentReferences?: DocumentReference[];
    knowledgeReferences?: KnowledgeReference[];
    organizationReferences?: OrganizationReference[];
  }): Promise<void> {
    const snapshot = this.persistence.snapshot();
    const product = snapshot.products.find((item) => item.productId === input.productId);
    if (!product) {
      throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
    }

    if (product.tenantId !== input.tenantId) {
      throw new ProductError("TENANT_MISMATCH", `tenant mismatch for product ${input.productId}`, false, true, "HIGH");
    }

    const assetReferences = input.assetReferences ?? [];
    const documentReferences = input.documentReferences ?? [];
    const knowledgeReferences = input.knowledgeReferences ?? [];
    const organizationReferences = input.organizationReferences ?? [];

    const allReferences = [
      ...assetReferences.map((item) => ({
        item,
        value: item.assetId,
        kind: "asset",
      })),
      ...documentReferences.map((item) => ({
        item,
        value: item.documentId,
        kind: "document",
      })),
      ...knowledgeReferences.map((item) => ({
        item,
        value: item.knowledgeId,
        kind: "knowledge",
      })),
      ...organizationReferences.map((item) => ({
        item,
        value: item.organizationId,
        kind: "organization",
      })),
    ];

    for (const reference of allReferences) {
      if (
        reference.item.productId !== input.productId ||
        reference.item.tenantId !== input.tenantId ||
        !reference.item.referenceId ||
        !reference.value
      ) {
        await this.persistence.recordReferenceFailure();
        await this.audit.append({
          eventType: "PRODUCT_REFERENCE_REJECTED",
          tenantId: input.tenantId,
          productId: input.productId,
          actor: input.actor,
          message: `${reference.kind} reference rejected`,
        });
        throw new ProductError("REFERENCE_INVALID", `${reference.kind} reference invalid`, false, true, "HIGH");
      }
    }

    await this.persistence.mutate((state) => {
      state.assetReferences.push(...assetReferences);
      state.documentReferences.push(...documentReferences);
      state.knowledgeReferences.push(...knowledgeReferences);
      state.organizationReferences.push(...organizationReferences);
    });

    await this.audit.append({
      eventType: "PRODUCT_REFERENCES_REGISTERED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: "product references registered",
      details: {
        assetReferences: assetReferences.length,
        documentReferences: documentReferences.length,
        knowledgeReferences: knowledgeReferences.length,
        organizationReferences: organizationReferences.length,
      },
    });
  }
}
