import {
  FOUNDATION_CATEGORIES,
  FOUNDATION_MANUFACTURERS,
  FOUNDATION_PRODUCTS,
} from "./catalog-fixtures";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import {
  validateCategoryHierarchy,
  validateManufacturerReference,
  validateNewProductInput,
  validateUpdateProductInput,
} from "./catalog-validation";
import {
  createCanonicalCatalogReadModel,
  projectProductConfiguration,
  type CanonicalCatalogReadModel,
  type CanonicalProduct,
  type ProductFamily,
} from "./canonical-catalog";
import type {
  NewProductInput,
  ProductCategory,
  ProductConfiguration,
  ProductManufacturer,
  ProductValidationResult,
  UpdateProductInput,
} from "./types";

const PERSISTENCE_NAMESPACE = "product-repository";

type ProductRepositoryState = {
  products: ProductConfiguration[];
  categories: ProductCategory[];
  manufacturers: ProductManufacturer[];
};

const productStore = new Map<string, ProductConfiguration>();
const categoryStore = new Map<string, ProductCategory>();
const manufacturerStore = new Map<string, ProductManufacturer>();

function createSeedState(): ProductRepositoryState {
  return {
    products: FOUNDATION_PRODUCTS.map((product) => deepClone(product)),
    categories: FOUNDATION_CATEGORIES.map((category) => deepClone(category)),
    manufacturers: FOUNDATION_MANUFACTURERS.map((manufacturer) => deepClone(manufacturer)),
  };
}

function applyState(state: ProductRepositoryState): void {
  productStore.clear();
  state.products.forEach((product) => {
    productStore.set(product.productId, deepClone(product));
  });

  categoryStore.clear();
  state.categories.forEach((category) => {
    categoryStore.set(category.categoryId, deepClone(category));
  });

  manufacturerStore.clear();
  state.manufacturers.forEach((manufacturer) => {
    manufacturerStore.set(manufacturer.manufacturerId, deepClone(manufacturer));
  });
}

function snapshotState(): ProductRepositoryState {
  return {
    products: Array.from(productStore.values()).map((product) => deepClone(product)),
    categories: Array.from(categoryStore.values()).map((category) => deepClone(category)),
    manufacturers: Array.from(manufacturerStore.values()).map((manufacturer) =>
      deepClone(manufacturer),
    ),
  };
}

let stateRevision = 0;

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<ProductRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<ProductRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

loadStateFromPersistence();

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

export function getCanonicalProduct(
  productId: string,
  productFamilies: readonly ProductFamily[] = [],
): CanonicalProduct | null {
  const product = getProductById(productId);
  return product ? projectProductConfiguration({ product, productFamilies }) : null;
}

export function listCanonicalProducts(
  productFamilies: readonly ProductFamily[] = [],
): readonly CanonicalProduct[] {
  return listProducts().map((product) => projectProductConfiguration({ product, productFamilies }));
}

export function getCanonicalCatalogReadModel(
  productFamilies: readonly ProductFamily[] = [],
): CanonicalCatalogReadModel {
  return createCanonicalCatalogReadModel({ products: listProducts(), productFamilies });
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
  persistCurrentState();
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
  persistCurrentState();
  return { validation, product: updated };
}

export function validateCategories(): ProductValidationResult {
  return validateCategoryHierarchy(listCategories());
}

export function resetProductRepositoryForTests(): void {
  const reset = resetPersistedState<ProductRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
}
