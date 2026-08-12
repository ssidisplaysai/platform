import { getEnterpriseRegistryService } from "@/platform/ear";
import { createEnterpriseAggregationEngine } from "./aggregation-engine";
import { createEnterpriseCapabilityEngine } from "./capability-engine";
import { createEnterpriseHealthEvaluationEngine } from "./evaluation-engine";
import { createInMemoryEnterpriseHealthRepository } from "./repository";
import { createEnterpriseHealthService, type EnterpriseHealthService } from "./service";

let singleton: EnterpriseHealthService | null = null;

export async function getEnterpriseHealthService(): Promise<EnterpriseHealthService> {
  if (!singleton) {
    singleton = createEnterpriseHealthService({
      earService: getEnterpriseRegistryService(),
      repository: createInMemoryEnterpriseHealthRepository(),
      evaluationEngine: createEnterpriseHealthEvaluationEngine(),
      capabilityEngine: createEnterpriseCapabilityEngine(),
      aggregationEngine: createEnterpriseAggregationEngine(),
    });

    await singleton.bootstrapFromRegistrySimulation();
  }

  return singleton;
}

export function resetEnterpriseHealthServiceForTests(): void {
  singleton = null;
}
