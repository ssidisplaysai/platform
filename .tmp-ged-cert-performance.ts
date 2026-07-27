import { performance } from "node:perf_hooks";
import { createInMemoryEnterpriseDomainRepository } from "./src/lib/ged/enterprise-domain-repository";
import { createEnterpriseDomainRuntimeService } from "./src/lib/ged/enterprise-domain-runtime";
import { enterpriseId, stableEnterpriseChecksum } from "./src/lib/ged/enterprise-domain-models";

const runtime = createEnterpriseDomainRuntimeService(createInMemoryEnterpriseDomainRepository());

async function measure(label: string, fn: () => Promise<unknown>) {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    await fn();
    samples.push(performance.now() - started);
  }
  return {
    label,
    avg: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3)),
    min: Number(Math.min(...samples).toFixed(3)),
    max: Number(Math.max(...samples).toFixed(3)),
  };
}

(async () => {
  const entityLookup = await measure("entity_lookup", () => runtime.getEntity("project"));
  const relationshipTraversal = await measure("relationship_traversal", () => runtime.listRelationships("project"));
  const validationExecution = await measure("validation_execution", () => runtime.validateDomain());
  const healthChecks = await measure("health_checks", () => runtime.listHealth());

  const identitySamples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    const id = enterpriseId("ged-identity-bench", { entity: "project", i });
    const checksum = stableEnterpriseChecksum({ entity: "project", i, id });
    if (!id || !checksum) throw new Error("Identity benchmark failed");
    identitySamples.push(performance.now() - started);
  }

  const identityGeneration = {
    label: "identity_generation",
    avg: Number((identitySamples.reduce((sum, value) => sum + value, 0) / identitySamples.length).toFixed(3)),
    min: Number(Math.min(...identitySamples).toFixed(3)),
    max: Number(Math.max(...identitySamples).toFixed(3)),
  };

  console.log(JSON.stringify({ entityLookup, relationshipTraversal, identityGeneration, validationExecution, healthChecks }, null, 2));
})();