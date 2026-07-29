import {
  FOUNDATION_CATEGORIES,
  FOUNDATION_MANUFACTURERS,
  FOUNDATION_PRODUCTS,
} from "./catalog-fixtures";
import {
  validateCategoryHierarchy,
  validateManufacturerReference,
  validateNewProductInput,
  validateUpdateProductInput,
} from "./catalog-validation";
import type {
  NewProductInput,
  ProductCategory,
  ProductConfiguration,
  ProductManufacturer,
  ProductValidationResult,
  UpdateProductInput,
} from "./types";

const productStore = new Map<string, ProductConfiguration>(
  FOUNDATION_PRODUCTS.map((product) => [product.productId, product]),
);

const categoryStore = new Map<string, ProductCategory>(
  FOUNDATION_CATEGORIES.map((category) => [category.categoryId, category]),
);

const manufacturerStore = new Map<string, ProductManufacturer>(
  FOUNDATION_MANUFACTURERS.map((manufacturer) => [manufacturer.manufacturerId, manufacturer]),
);

function nowIso(): string {
  return new Date().toISOString();
}

function createProductId(organizationId: string, slug: string): string {
  return `prod-${organizationId}-${slug}`;
}

function hasDuplicateSlug(
  organizationId: string,
  slug: string,
  excludingProductId?: string,
): boolean {
  return Array.from(productStore.values()).some(
    (product) =>
      product.organizationId === organizationId &&
      product.slug === slug &&
      product.productId !== excludingProductId,
  );
}

function hasDuplicateSku(
  organizationId: string,
  sku: string,
  excludingProductId?: string,
): boolean {
  return Array.from(productStore.values()).some(
    (product) =>
      product.organizationId === organizationId &&
      product.sku === sku &&
      product.productId !== excludingProductId,
  );
}

export function listProducts(): readonly ProductConfiguration[] {
  return Array.from(productStore.values());
}

export function getProductById(productId: string): ProductConfiguration | null {
  return productStore.get(productId) ?? null;
}

export function listCategories(): readonly ProductCategory[] {
  return Array.from(categoryStore.values());
}

export function listManufacturers(): readonly ProductManufacturer[] {
  return Array.from(manufacturerStore.values());
}

export function createProduct(input: NewProductInput): {
  validation: ProductValidationResult;
  product: ProductConfiguration | null;
} {
  const validation = validateNewProductInput(input);
  if (!validation.valid) {
    return { validation, product: null };
  }

  if (hasDuplicateSlug(input.organizationId, input.slug)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "slug", message: "Product slug already exists." }],
      },
      product: null,
    };
  }

  if (hasDuplicateSku(input.organizationId, input.sku)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "sku", message: "Product SKU already exists." }],
      },
      product: null,
    };
  }

  const manufacturerValidation = validateManufacturerReference(
    input.manufacturerId,
    listManufacturers(),
  );
  if (!manufacturerValidation.valid) {
    return { validation: manufacturerValidation, product: null };
  }

  const timestamp = nowIso();
  const productId = createProductId(input.organizationId, input.slug);
  const product: ProductConfiguration = {
    ...input,
    productId,
    lifecycleState: "draft",
    catalogStatus: "incomplete",
    enabled: false,
    visibility: "internal",
    featured: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: null,
  };

  productStore.set(productId, product);
  return { validation, product };
}

export function updateProduct(
  productId: string,
  patch: UpdateProductInput,
): {
  validation: ProductValidationResult;
  product: ProductConfiguration | null;
} {
  const existing = getProductById(productId);
  if (!existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "productId", message: "Product not found." }],
      },
      product: null,
    };
  }

  const validation = validateUpdateProductInput(existing, patch);
  if (!validation.valid) {
    return { validation, product: null };
  }

  if (patch.slug && hasDuplicateSlug(existing.organizationId, patch.slug, existing.productId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "slug", message: "Product slug already exists." }],
      },
      product: null,
    };
  }

  if (patch.sku && hasDuplicateSku(existing.organizationId, patch.sku, existing.productId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "sku", message: "Product SKU already exists." }],
      },
      product: null,
    };
  }

  if (patch.manufacturerId !== undefined) {
    const manufacturerValidation = validateManufacturerReference(
      patch.manufacturerId,
      listManufacturers(),
    );
    if (!manufacturerValidation.valid) {
      return { validation: manufacturerValidation, product: null };
    }
  }

  const updated: ProductConfiguration = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  productStore.set(productId, updated);
  return { validation, product: updated };
}

export function validateCategories(): ProductValidationResult {
  return validateCategoryHierarchy(listCategories());
}
