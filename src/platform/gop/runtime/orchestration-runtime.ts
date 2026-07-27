import { createGenesisOrchestrationRuntime } from "./orchestrator";
import { createPrismaExecutionRepository } from "./execution-repository";

let singleton: ReturnType<typeof createGenesisOrchestrationRuntime> | null = null;

export function getGenesisOrchestrationRuntime() {
  if (!singleton) {
    singleton = createGenesisOrchestrationRuntime({
      repository: createPrismaExecutionRepository(),
    });
  }

  return singleton;
}

export function setGenesisOrchestrationRuntimeForTests(runtime: ReturnType<typeof createGenesisOrchestrationRuntime> | null): void {
  singleton = runtime;
}
