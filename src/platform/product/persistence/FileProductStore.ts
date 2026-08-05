import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ProductError,
  createDefaultProductPersistedState,
  type ProductPersistedState,
} from "../contracts";
import type { ProductStore } from "./types";

type FileProductStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): ProductPersistedState {
  if (!raw || typeof raw !== "object") {
    throw new ProductError("STATE_CORRUPT", "product state must be an object", false, true, "CRITICAL");
  }

  const candidate = raw as Partial<ProductPersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    throw new ProductError("STATE_CORRUPT", "unsupported product state schema", false, true, "CRITICAL");
  }

  const requiredArrays: Array<keyof ProductPersistedState> = [
    "products",
    "variants",
    "productFamilies",
    "categories",
    "attributeDefinitions",
    "optionDefinitions",
    "configurations",
    "productRelationships",
    "productBundles",
    "productKits",
    "productVersions",
    "pricingDefinitions",
    "billOfMaterialDefinitions",
    "assetReferences",
    "documentReferences",
    "knowledgeReferences",
    "organizationReferences",
    "audits",
  ];

  for (const field of requiredArrays) {
    if (!Array.isArray(candidate[field])) {
      throw new ProductError("STATE_CORRUPT", `product state ${field} must be an array`, false, true, "CRITICAL");
    }
  }

  const defaults = createDefaultProductPersistedState();
  return {
    schemaVersion: "1.0.0",
    products: candidate.products!,
    variants: candidate.variants!,
    productFamilies: candidate.productFamilies!,
    categories: candidate.categories!,
    attributeDefinitions: candidate.attributeDefinitions!,
    optionDefinitions: candidate.optionDefinitions!,
    configurations: candidate.configurations!,
    productRelationships: candidate.productRelationships!,
    productBundles: candidate.productBundles!,
    productKits: candidate.productKits!,
    productVersions: candidate.productVersions!,
    pricingDefinitions: candidate.pricingDefinitions!,
    billOfMaterialDefinitions: candidate.billOfMaterialDefinitions!,
    assetReferences: candidate.assetReferences!,
    documentReferences: candidate.documentReferences!,
    knowledgeReferences: candidate.knowledgeReferences!,
    organizationReferences: candidate.organizationReferences!,
    audits: candidate.audits!,
    metrics: candidate.metrics ?? defaults.metrics,
  };
}

export class FileProductStore implements ProductStore {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileProductStoreOptions) {
    this.filePath = resolve(options.rootDir, "product", "product-state.v1.json");
  }

  private async ensureDir(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const wait = this.lock;
    let release: () => void = () => undefined;
    this.lock = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await wait;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  async load(): Promise<ProductPersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload) as unknown;
        } catch {
          throw new ProductError("STATE_CORRUPT", "product state is not valid JSON", false, true, "CRITICAL");
        }
        return normalize(parsed);
      } catch (error) {
        if (error instanceof ProductError) {
          throw error;
        }
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultProductPersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }
        throw new ProductError("RECOVERY_FAILURE", "product state read failed", false, true, "CRITICAL");
      }
    });
  }

  async save(state: ProductPersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
