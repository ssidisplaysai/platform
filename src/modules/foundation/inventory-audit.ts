import type { InventoryActivityRecord, InventoryActivityType } from "./types";

const inventoryActivityStore: InventoryActivityRecord[] = [];

function createActivityId(organizationId: string, type: InventoryActivityType): string {
  return `${organizationId}-${type}-${Date.now()}`;
}

export function recordInventoryActivity(input: {
  organizationId: string;
  productId: string | null;
  locationId: string | null;
  type: InventoryActivityType;
  actor: string;
  summary: string;
}): InventoryActivityRecord {
  const entry: InventoryActivityRecord = {
    activityId: createActivityId(input.organizationId, input.type),
    organizationId: input.organizationId,
    productId: input.productId,
    locationId: input.locationId,
    type: input.type,
    actor: input.actor,
    createdAt: new Date().toISOString(),
    summary: input.summary,
  };

  inventoryActivityStore.unshift(entry);
  return entry;
}

export function listInventoryActivity(filters?: {
  organizationId?: string;
  productId?: string;
  locationId?: string;
}): readonly InventoryActivityRecord[] {
  return inventoryActivityStore.filter((entry) => {
    if (filters?.organizationId && entry.organizationId !== filters.organizationId) {
      return false;
    }
    if (filters?.productId && entry.productId !== filters.productId) {
      return false;
    }
    if (filters?.locationId && entry.locationId !== filters.locationId) {
      return false;
    }
    return true;
  });
}
