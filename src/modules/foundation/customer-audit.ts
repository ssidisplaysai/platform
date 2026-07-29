import type { CustomerActivityRecord, CustomerActivityType } from "./types";

const customerActivityStore: CustomerActivityRecord[] = [];

function createActivityId(customerId: string, type: CustomerActivityType): string {
  return `${customerId}-${type}-${Date.now()}`;
}

export function recordCustomerActivity(input: {
  customerId: string;
  organizationId: string;
  type: CustomerActivityType;
  actor: string;
  summary: string;
}): CustomerActivityRecord {
  const entry: CustomerActivityRecord = {
    activityId: createActivityId(input.customerId, input.type),
    customerId: input.customerId,
    organizationId: input.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: new Date().toISOString(),
    summary: input.summary,
  };

  customerActivityStore.unshift(entry);
  return entry;
}

export function listCustomerActivity(customerId: string): readonly CustomerActivityRecord[] {
  return customerActivityStore.filter((entry) => entry.customerId === customerId);
}

export function resetCustomerActivityForTests(): void {
  customerActivityStore.length = 0;
}
