import type {
  BusinessGenome,
  BusinessGenomeIR,
  GenomeDiagnostic,
  GenomeObjectBase,
} from "./BusinessGenomeIR";
import { GenomeIdentityFactory } from "./GenomeIdentity";

function isSorted(ids: readonly string[]): boolean {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  return ids.every((value, index) => value === sorted[index]);
}

function pushError(diagnostics: GenomeDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "error", message, context });
}

function pushWarning(diagnostics: GenomeDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "warning", message, context });
}

function validateObjects(
  diagnostics: GenomeDiagnostic[],
  objects: readonly GenomeObjectBase[],
  objectType: string,
): void {
  for (const object of objects) {
    if (!object.provenance.sourceEvidenceIdentity || !object.provenance.sourceKnowledgeId) {
      pushError(diagnostics, "BG-VAL-001", `Missing provenance on ${objectType}`, { objectId: object.identity.id });
    }

    if (!object.lineage.sourceKnowledgeId || object.lineage.transformationPath.length === 0) {
      pushError(diagnostics, "BG-VAL-012", `Incomplete lineage on ${objectType}`, { objectId: object.identity.id });
    }

    if (!GenomeIdentityFactory.isValid(object.identity.id)) {
      pushError(diagnostics, "BG-VAL-002", `Invalid genome identity on ${objectType}`, { objectId: object.identity.id });
    }

    if (object.temporalValidity.validTo && object.temporalValidity.validTo < object.temporalValidity.validFrom) {
      pushError(diagnostics, "BG-VAL-010", `Temporal invalidity on ${objectType}`, { objectId: object.identity.id });
    }

    if (!object.canonicalName.trim() || !object.canonicalContent.trim()) {
      pushError(diagnostics, "BG-VAL-003", `Malformed ${objectType}`, { objectId: object.identity.id });
    }
  }

  const identities = objects.map((entry) => entry.identity.id);
  if (!isSorted(identities)) {
    pushError(diagnostics, "BG-VAL-011", `Nondeterministic ordering in ${objectType}`);
  }
}

export class BusinessGenomeValidator {
  validate(ir: BusinessGenomeIR): readonly GenomeDiagnostic[] {
    const diagnostics: GenomeDiagnostic[] = [];
    const bg = ir.businessGenome;

    validateObjects(diagnostics, bg.entities, "entities");
    validateObjects(diagnostics, bg.relationships, "relationships");
    validateObjects(diagnostics, bg.capabilities, "capabilities");
    validateObjects(diagnostics, bg.processes, "processes");
    validateObjects(diagnostics, bg.policies, "policies");
    validateObjects(diagnostics, bg.rules, "rules");
    validateObjects(diagnostics, bg.roles, "roles");
    validateObjects(diagnostics, bg.responsibilities, "responsibilities");
    validateObjects(diagnostics, bg.resources, "resources");
    validateObjects(diagnostics, bg.events, "events");
    validateObjects(diagnostics, bg.workflows, "workflows");
    validateObjects(diagnostics, bg.constraints, "constraints");
    validateObjects(diagnostics, bg.metrics, "metrics");
    validateObjects(diagnostics, bg.objectives, "objectives");
    validateObjects(diagnostics, bg.conflicts, "conflicts");

    const entityIds = new Set(bg.entities.map((entry) => entry.identity.id));

    for (const relationship of bg.relationships) {
      if (!entityIds.has(relationship.sourceEntityId) || !entityIds.has(relationship.targetEntityId)) {
        pushError(diagnostics, "BG-VAL-013", "Graph integrity violation: relationship endpoint missing", {
          relationshipId: relationship.identity.id,
          sourceEntityId: relationship.sourceEntityId,
          targetEntityId: relationship.targetEntityId,
        });
      }
    }

    const relationshipKeys = new Set<string>();
    for (const relationship of bg.relationships) {
      const key = `${relationship.sourceEntityId}|${relationship.targetEntityId}|${relationship.relationshipType}`;
      if (relationshipKeys.has(key)) {
        pushError(diagnostics, "BG-VAL-007", "Duplicate relationships detected", {
          relationshipId: relationship.identity.id,
        });
      }
      relationshipKeys.add(key);
    }

    const ruleIds = new Set(bg.rules.map((entry) => entry.identity.id));
    for (const policy of bg.policies) {
      for (const ruleId of policy.ruleIds) {
        if (!ruleIds.has(ruleId)) {
          pushError(diagnostics, "BG-VAL-005", "Invalid policy rule reference", {
            policyId: policy.identity.id,
            ruleId,
          });
        }
      }
    }

    const roleIds = new Set(bg.roles.map((entry) => entry.identity.id));
    const processIds = new Set(bg.processes.map((entry) => entry.identity.id));
    for (const responsibility of bg.responsibilities) {
      if (!roleIds.has(responsibility.roleId)) {
        pushError(diagnostics, "BG-VAL-006", "Invalid role reference", {
          responsibilityId: responsibility.identity.id,
          roleId: responsibility.roleId,
        });
      }

      if (responsibility.processId && !processIds.has(responsibility.processId)) {
        pushError(diagnostics, "BG-VAL-008", "Broken process reference on responsibility", {
          responsibilityId: responsibility.identity.id,
          processId: responsibility.processId,
        });
      }
    }

    const eventIds = new Set(bg.events.map((entry) => entry.identity.id));
    for (const workflow of bg.workflows) {
      for (const processId of workflow.processIds) {
        if (!processIds.has(processId)) {
          pushError(diagnostics, "BG-VAL-008", "Broken workflow process reference", {
            workflowId: workflow.identity.id,
            processId,
          });
        }
      }

      for (const eventId of workflow.eventIds) {
        if (!eventIds.has(eventId)) {
          pushError(diagnostics, "BG-VAL-008", "Broken workflow event reference", {
            workflowId: workflow.identity.id,
            eventId,
          });
        }
      }
    }

    for (const conflict of bg.conflicts) {
      if (conflict.required && conflict.status !== "resolved" && conflict.blocking) {
        pushError(diagnostics, "BG-VAL-009", "Unresolved required conflict blocks compilation", {
          conflictId: conflict.identity.id,
        });
      }
    }

    const hashRecomputed = ir.deterministicHash.length === 64;
    if (!hashRecomputed) {
      pushError(diagnostics, "BG-VAL-014", "Deterministic hash malformed");
    }

    if (diagnostics.length === 0) {
      pushWarning(diagnostics, "BG-VAL-000", "Business Genome validation completed with no blocking errors");
    }

    return diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  }

  hasBlockingErrors(diagnostics: readonly GenomeDiagnostic[]): boolean {
    return diagnostics.some((entry) => entry.severity === "error");
  }

  validateGenomeOnly(genome: BusinessGenome): readonly GenomeDiagnostic[] {
    const ir: BusinessGenomeIR = {
      schemaVersion: "1.0.0",
      businessGenome: genome,
      compilationContext: {
        compilerVersion: "1.0.0",
        pipelineVersion: "1.0.0",
        compiledAt: genome.generatedAt,
        sourceKnowledgeHash: "unknown",
        sourceKnowledgeCount: 0,
        sourceTypes: [],
        sourceIds: [],
        deterministicRunId: "validation-only",
      },
      diagnostics: [],
      metrics: {
        inputKnowledgeEntities: 0,
        inputKnowledgeFacts: 0,
        inputKnowledgeRelationships: 0,
        entitiesProjected: genome.entities.length,
        relationshipsProjected: genome.relationships.length,
        capabilitiesExtracted: genome.capabilities.length,
        processesExtracted: genome.processes.length,
        policiesExtracted: genome.policies.length,
        rulesExtracted: genome.rules.length,
        rolesExtracted: genome.roles.length,
        responsibilitiesMapped: genome.responsibilities.length,
        resourcesIdentified: genome.resources.length,
        eventsIdentified: genome.events.length,
        workflowsConstructed: genome.workflows.length,
        constraintsIdentified: genome.constraints.length,
        metricsIdentified: genome.metrics.length,
        objectivesIdentified: genome.objectives.length,
        conflictsPreserved: genome.conflicts.length,
        blockingConflicts: genome.conflicts.filter((entry) => entry.blocking).length,
        diagnosticsCount: 0,
        executionTimeMs: 0,
      },
      deterministicHash: "0".repeat(64),
      deterministicSerialization: "{}",
      compiledFromKnowledgeHash: "unknown",
      generatedAt: genome.generatedAt,
    };

    return this.validate(ir);
  }
}
