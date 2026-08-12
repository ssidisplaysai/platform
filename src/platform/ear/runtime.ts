import { createInMemoryEnterpriseRegistryRepository } from "./repository";
import { createEnterpriseRegistryService, type EnterpriseRegistryService } from "./service";
import { ENTERPRISE_REGISTRY_SEED } from "./seed";
import { createEnterpriseRegistryValidationEngine } from "./validation";
import type { ApplicationRegistration } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function materializeSeed(): ApplicationRegistration[] {
  const now = nowIso();
  return ENTERPRISE_REGISTRY_SEED.map((entry) => ({
    ...entry,
    createdAt: now,
    updatedAt: now,
  }));
}

let enterpriseRegistryServiceSingleton: EnterpriseRegistryService | null = null;

export function getEnterpriseRegistryService(): EnterpriseRegistryService {
  if (!enterpriseRegistryServiceSingleton) {
    const repository = createInMemoryEnterpriseRegistryRepository(materializeSeed());
    enterpriseRegistryServiceSingleton = createEnterpriseRegistryService({
      repository,
      validation: createEnterpriseRegistryValidationEngine(),
    });
  }

  return enterpriseRegistryServiceSingleton;
}

export function resetEnterpriseRegistryServiceForTests(): void {
  enterpriseRegistryServiceSingleton = null;
}
