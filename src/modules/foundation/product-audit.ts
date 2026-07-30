import type { ProductActivityRecord, ProductActivityType } from "./types";

const productActivityStore: ProductActivityRecord[] = [];

function createActivityId(productId: string, type: ProductActivityType): string {
  return `${productId}-${type}-${Date.now()}`;
}

export function recordProductActivity(input: {
  productId: string;
  organizationId: string;
  type: ProductActivityType;
  actor: string;
  summary: string;
}): ProductActivityRecord {
  const entry: ProductActivityRecord = {
    activityId: createActivityId(input.productId, input.type),
    productId: input.productId,
    organizationId: input.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: new Date().toISOString(),
    summary: input.summary,
  };

  productActivityStore.unshift(entry);
  return entry;
}

export function listProductActivity(productId: string): readonly ProductActivityRecord[] {
  return productActivityStore.filter((entry) => entry.productId === productId);
}
