import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import type { BusinessGenomeCompilerInput } from "../types";
import type { BusinessGenomePassResult, ValidatedEvidenceIRView } from "../pipeline-types";
import { updatePassHistory } from "../pipeline-types";

function isValidEvidenceIdentity(value: string): boolean {
  return value.length > 0;
}

export class InputValidationPass
  implements CompilerPass<BusinessGenomeCompilerInput, BusinessGenomePassResult<ValidatedEvidenceIRView>>
{
  readonly metadata = {
    id: "bgc.input-validation",
    version: "1.0.0",
    description: "Validate Evidence IR structural contract for Business Genome compilation.",
    inputType: "evidence-ir-input",
    outputType: "validated-evidence-ir-view",
    dependencies: [],
    capabilities: ["validation", "contract-enforcement"],
    lifecycle: "active" as const,
  };

  execute(
    input: BusinessGenomeCompilerInput,
    _context: CompilerPassContext,
  ): BusinessGenomePassResult<ValidatedEvidenceIRView> {
    const diagnostics = [];

    if (!input || !input.evidenceIR) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.MISSING_INPUT,
          "error",
          "Business Genome compiler input is missing Evidence IR.",
          this.metadata.id,
        ),
      );
    }

    if (!input?.evidenceIrIdentity) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.MISSING_EVIDENCE_IR_IDENTITY,
          "error",
          "Evidence IR root identity is missing.",
          this.metadata.id,
        ),
      );
    }

    if (input?.evidenceIR && !input.evidenceIR.schemaVersion) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.INVALID_EVIDENCE_IR_SCHEMA_VERSION,
          "error",
          "Evidence IR schema version is missing.",
          this.metadata.id,
          { expected: "1.0.0" },
        ),
      );
    }

    if (!input?.upstreamValidation?.status) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.MISSING_UPSTREAM_VALIDATION_STATUS,
          "error",
          "Upstream validation status is missing and cannot be audited.",
          this.metadata.id,
        ),
      );
    }

    if (input?.upstreamValidation?.status === "invalid") {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.UPSTREAM_VALIDATION_FAILED,
          "error",
          "Upstream validation reported invalid Evidence IR; semantic compilation is blocked.",
          this.metadata.id,
          {
            validator: input.upstreamValidation.validator,
            details: input.upstreamValidation.details ?? {},
          },
        ),
      );
    }

    if (!input?.canonicalMetadata) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.MISSING_CANONICAL_METADATA,
          "error",
          "Canonical metadata is required for downstream verification passes.",
          this.metadata.id,
        ),
      );
    }

    const evidenceNodes = [...(input?.evidenceIR?.graph.nodes ?? [])]
      .filter((node) => node.nodeType === "artifact")
      .sort((a, b) => a.id.localeCompare(b.id));

    if (evidenceNodes.length === 0) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.INPUT.MISSING_EVIDENCE_COLLECTION,
          "error",
          "Evidence IR contains no evidence artifact nodes for grouping and semantic correlation.",
          this.metadata.id,
        ),
      );
    }

    const seenEvidenceIds = new Set<string>();
    const sourceNodeIds = new Set(
      [...(input?.evidenceIR?.graph.nodes ?? [])]
        .filter((node) => node.nodeType === "source")
        .map((node) => node.id),
    );

    for (const node of evidenceNodes) {
      if (!isValidEvidenceIdentity(node.id) || !node.artifactId || !node.versionId) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.INPUT.INVALID_EVIDENCE_ITEM_IDENTITY,
            "error",
            `Evidence item identity is invalid for node ${node.id}.`,
            this.metadata.id,
            {
              nodeId: node.id,
              artifactId: node.artifactId,
              versionId: node.versionId,
            },
            node.id,
          ),
        );
      }

      if (!node.lineage?.sourceId || !Array.isArray(node.lineage.parentNodeIds)) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.INPUT.MISSING_PROVENANCE_REFERENCE,
            "error",
            `Evidence provenance is incomplete for node ${node.id}.`,
            this.metadata.id,
            {
              nodeId: node.id,
            },
            node.id,
          ),
        );
      }

      const dedupeKey = `${node.artifactId}:${node.versionId}`;
      if (seenEvidenceIds.has(dedupeKey)) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.INPUT.DUPLICATE_EVIDENCE_IDENTITY,
            "error",
            `Duplicate evidence identity detected: ${dedupeKey}.`,
            this.metadata.id,
            {
              nodeId: node.id,
              dedupeKey,
            },
            node.id,
          ),
        );
      }
      seenEvidenceIds.add(dedupeKey);

      const sourceNodeId = `source:${node.sourceId}`;
      if (!sourceNodeIds.has(sourceNodeId)) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.INPUT.UNRESOLVED_SOURCE_REFERENCE,
            "error",
            `Evidence source reference is unresolved for node ${node.id}.`,
            this.metadata.id,
            {
              nodeId: node.id,
              sourceNodeId,
            },
            node.id,
          ),
        );
      }
    }

    const sortedDiagnostics = sortDiagnostics(diagnostics);
    const fatal = sortedDiagnostics.some((entry) => entry.severity === "error");

    const view: ValidatedEvidenceIRView = {
      sourceEvidenceIrIdentity: input.evidenceIrIdentity,
      evidenceIR: input.evidenceIR,
      evidenceItemIds: evidenceNodes.map((node) => node.id),
      evidenceReferences: evidenceNodes.map((node) => ({
        evidenceNodeId: node.id,
        sourceId: node.sourceId,
        sourceType: node.sourceType,
        origin: node.origin,
        evidenceChecksum: node.checksum,
        metadataRef: node.metadata,
        provenanceRef: {
          sourceId: node.lineage.sourceId,
          parentNodeIds: [...node.lineage.parentNodeIds].sort(),
          transformationSteps: [...node.lineage.transformationSteps].sort(),
        },
      })),
      sourceReferences: [...sourceNodeIds].sort(),
      canonicalMetadata: {
        ...input.canonicalMetadata,
      },
      upstreamValidation: {
        ...input.upstreamValidation,
      },
      diagnostics: sortedDiagnostics,
      passHistory: updatePassHistory(
        input.evidenceIR.graph.nodes.length >= 0
          ? [
              {
                passId: this.metadata.id,
                version: this.metadata.version,
                status: fatal ? "failed" : "completed",
                diagnosticCount: sortedDiagnostics.length,
              },
            ]
          : [],
        this.metadata.id,
        this.metadata.version,
        fatal ? "failed" : "completed",
        sortedDiagnostics.length,
      ),
      deterministicOrderingContext: {
        evidenceNodeOrder: evidenceNodes.map((node) => node.id),
        evidenceRelationshipOrder: [...input.evidenceIR.graph.relationships]
          .map((relationship) => relationship.id)
          .sort(),
      },
      compilerVersion: input.compilerVersion,
      specificationVersion: input.specificationVersion,
      validationStatus: fatal ? "invalid" : "valid",
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: view,
      diagnostics: sortedDiagnostics,
      fatal,
    };
  }
}
