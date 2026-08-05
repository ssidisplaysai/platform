import { assertLifecycleTransitionAllowed } from "../domain";
import { ProductError, type LifecycleState, type Product, type ProductActorContext, type ProductMetadata } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeProductCode(input: string): string {
  return input.trim().toUpperCase();
}

export class ProductCatalogService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async createProduct(input: {
    tenantId: string;
    productId: string;
    productCode: string;
    versionIdentifier: string;
    displayName: string;
    lifecycleState: LifecycleState;
    metadata: ProductMetadata;
    productFamilyId: string;
    categoryId: string;
    actor: ProductActorContext;
  }): Promise<Product> {
    if (
      !input.tenantId ||
      !input.productId ||
      !input.productCode ||
      !input.versionIdentifier ||
      !input.displayName ||
      !input.productFamilyId ||
      !input.categoryId ||
      !input.metadata
    ) {
      throw new ProductError("PRODUCT_INVALID", "missing required product fields", false, true, "HIGH");
    }

    const at = nowIso();
    const normalizedCode = normalizeProductCode(input.productCode);
    const product: Product = {
      productId: input.productId,
      tenantId: input.tenantId,
      productCode: normalizedCode,
      versionIdentifier: input.versionIdentifier.trim(),
      productFamilyId: input.productFamilyId,
      categoryId: input.categoryId,
      displayName: input.displayName.trim(),
      lifecycleState: input.lifecycleState,
      metadata: structuredClone(input.metadata),
      attributes: [],
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const duplicateId = state.products.some((item) => item.tenantId === product.tenantId && item.productId === product.productId);
      if (duplicateId) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate product id in tenant scope: ${product.productId}`, false, true, "HIGH");
      }

      const duplicateCode = state.products.some(
        (item) => item.tenantId === product.tenantId && item.productCode === product.productCode,
      );
      if (duplicateCode) {
        throw new ProductError(
          "PRODUCT_DUPLICATE",
          `duplicate product code in tenant scope: ${product.productCode}`,
          false,
          true,
          "HIGH",
        );
      }

      state.products.push(product);
    });

    await this.audit.append({
      eventType: "PRODUCT_CREATED",
      tenantId: product.tenantId,
      productId: product.productId,
      actor: input.actor,
      message: `product ${product.productId} created`,
      details: {
        productCode: product.productCode,
        versionIdentifier: product.versionIdentifier,
        lifecycleState: product.lifecycleState,
      },
    });

    return this.requireProduct(product.productId);
  }

  async transitionLifecycle(input: {
    tenantId: string;
    productId: string;
    nextLifecycleState: LifecycleState;
    expectedVersionIdentifier: string;
    actor: ProductActorContext;
    reason?: string;
  }): Promise<Product> {
    const snapshot = this.persistence.snapshot();
    const product = snapshot.products.find((item) => item.productId === input.productId);

    if (!product) {
      throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
    }

    if (product.tenantId !== input.tenantId) {
      throw new ProductError("TENANT_MISMATCH", `tenant mismatch for product ${input.productId}`, false, true, "HIGH");
    }

    if (product.versionIdentifier !== input.expectedVersionIdentifier) {
      await this.persistence.recordVersionConflict();
      await this.audit.append({
        eventType: "PRODUCT_REJECTED",
        tenantId: input.tenantId,
        productId: input.productId,
        actor: input.actor,
        message: "lifecycle transition rejected due to version conflict",
        details: {
          expectedVersionIdentifier: input.expectedVersionIdentifier,
          actualVersionIdentifier: product.versionIdentifier,
        },
      });
      throw new ProductError("VERSION_CONFLICT", "product version identifier mismatch", false, true, "HIGH");
    }

    assertLifecycleTransitionAllowed(product.lifecycleState, input.nextLifecycleState);

    await this.persistence.mutate((state) => {
      const target = state.products.find((item) => item.productId === input.productId);
      if (!target) {
        throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
      }
      target.lifecycleState = input.nextLifecycleState;
      target.updatedAt = nowIso();
      target.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "PRODUCT_LIFECYCLE_TRANSITIONED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `product lifecycle transitioned to ${input.nextLifecycleState}`,
      details: {
        reason: input.reason,
      },
    });

    return this.requireProduct(input.productId);
  }

  async reviseMetadata(input: {
    tenantId: string;
    productId: string;
    metadata: ProductMetadata;
    actor: ProductActorContext;
    immutable?: { productCode?: string; versionIdentifier?: string; productId?: string };
  }): Promise<Product> {
    await this.persistence.mutate((state) => {
      const target = state.products.find((item) => item.productId === input.productId);
      if (!target) {
        throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${input.productId}`, false, true, "MEDIUM");
      }
      if (target.tenantId !== input.tenantId) {
        throw new ProductError("TENANT_MISMATCH", `tenant mismatch for product ${input.productId}`, false, true, "HIGH");
      }

      if (
        input.immutable?.productId &&
        input.immutable.productId !== target.productId
      ) {
        throw new ProductError("IMMUTABLE_FIELD", "productId is immutable", false, true, "HIGH");
      }

      if (
        input.immutable?.productCode &&
        normalizeProductCode(input.immutable.productCode) !== target.productCode
      ) {
        throw new ProductError("IMMUTABLE_FIELD", "productCode is immutable", false, true, "HIGH");
      }

      if (
        input.immutable?.versionIdentifier &&
        input.immutable.versionIdentifier !== target.versionIdentifier
      ) {
        throw new ProductError("IMMUTABLE_FIELD", "versionIdentifier is immutable for in-place metadata revisions", false, true, "HIGH");
      }

      target.metadata = structuredClone(input.metadata);
      target.updatedAt = nowIso();
      target.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "PRODUCT_METADATA_REVISED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: "product metadata revised",
    });

    return this.requireProduct(input.productId);
  }

  private requireProduct(productId: string): Product {
    const found = this.persistence.snapshot().products.find((item) => item.productId === productId);
    if (!found) {
      throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${productId}`, false, true, "MEDIUM");
    }
    return structuredClone(found);
  }
}
