import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import type { BusinessGenomePassResult, CanonicalEvidenceAttestation, ValidatedEvidenceIRView } from "../pipeline-types";

const GPS_ID_PATTERN = /^[a-z][a-z0-9-]*_[a-f0-9]{64}_v[0-9]+$/;

function hasNondeterministicMetadata(metadata: Readonly<Record<string, unknown>>): boolean {
  const blockedFields = ["timestamp", "generatedAt", "rand", "random", "nonce", "uuid"];
  return blockedFields.some((field) => Object.keys(metadata).some((key) => key.toLowerCase().includes(field)));
}

export class CanonicalVerificationPass
  implements CompilerPass<ValidatedEvidenceIRView, BusinessGenomePassResult<CanonicalEvidenceAttestation>>
{
  readonly metadata = {
    id: "bgc.canonical-verification",
    version: "1.0.0",
    description: "Verify GPS-0001 and GPS-0002 assumptions for Evidence IR contracts.",
    inputType: "validated-evidence-ir-view",
    outputType: "canonical-evidence-attestation",
    dependencies: ["bgc.input-validation"],
    capabilities: ["canonical-verification", "identity-verification"],
    lifecycle: "active" as const,
  };

  execute(
    input: ValidatedEvidenceIRView,
    _context: CompilerPassContext,
  ): BusinessGenomePassResult<CanonicalEvidenceAttestation> {
    const diagnostics = [];

    const canonicalMetadata = input.canonicalMetadata;

    const gps0001Version =
      typeof canonicalMetadata.gps0001Version === "string"
        ? canonicalMetadata.gps0001Version
        : undefined;
    const gps0002Version =
      typeof canonicalMetadata.gps0002Version === "string"
        ? canonicalMetadata.gps0002Version
        : undefined;
    const canonicalizationVersion =
      typeof canonicalMetadata.canonicalizationVersion === "string"
        ? canonicalMetadata.canonicalizationVersion
        : undefined;
    const canonicalValidationStatus =
      typeof canonicalMetadata.canonicalValidationStatus === "string"
        ? canonicalMetadata.canonicalValidationStatus
        : undefined;

    if (!gps0001Version || !gps0002Version) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.MISSING_GPS_VERSION,
          "error",
          "GPS-0001 or GPS-0002 version declaration is missing in canonical metadata.",
          this.metadata.id,
          {
            gps0001Version,
            gps0002Version,
          },
        ),
      );
    }

    if (!canonicalizationVersion) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.MISSING_CANONICALIZATION_VERSION,
          "error",
          "Canonicalization version declaration is missing.",
          this.metadata.id,
        ),
      );
    }

    if (!canonicalValidationStatus) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.MISSING_CANONICAL_VALIDATION_STATUS,
          "error",
          "Canonical validation status is not explicit in pass input metadata.",
          this.metadata.id,
        ),
      );
    }

    if (canonicalValidationStatus === "failed") {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.MISSING_CANONICAL_VALIDATION_STATUS,
          "error",
          "Canonical validation status is failed; downstream semantic processing is blocked.",
          this.metadata.id,
        ),
      );
    }

    if (!GPS_ID_PATTERN.test(input.sourceEvidenceIrIdentity)) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.INVALID_CANONICAL_IDENTITY_FORMAT,
          "warning",
          "Evidence IR identity does not match GPS-0001 canonical identity format.",
          this.metadata.id,
          {
            evidenceIrIdentity: input.sourceEvidenceIrIdentity,
          },
        ),
      );
    }

    for (const reference of input.evidenceReferences) {
      if (!reference.evidenceChecksum) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.CANON.MISSING_CHECKSUM_REFERENCE,
            "warning",
            `Evidence checksum is missing for node ${reference.evidenceNodeId}.`,
            this.metadata.id,
            {
              evidenceNodeId: reference.evidenceNodeId,
            },
            reference.evidenceNodeId,
          ),
        );
      }

      if (hasNondeterministicMetadata(reference.metadataRef)) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.CANON.NONDETERMINISTIC_METADATA,
            "warning",
            `Evidence metadata contains nondeterministic fields for node ${reference.evidenceNodeId}.`,
            this.metadata.id,
            {
              evidenceNodeId: reference.evidenceNodeId,
            },
            reference.evidenceNodeId,
          ),
        );
      }
    }

    const expectedDeterministicHash = SourceHash.sha256(
      stableStringify({
        schemaVersion: input.evidenceIR.schemaVersion,
        graph: input.evidenceIR.graph.toObject(),
        artifactCount: input.evidenceIR.artifactCount,
        generatedAt: input.evidenceIR.generatedAt,
      }),
    );

    if (expectedDeterministicHash !== input.evidenceIR.deterministicHash) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CANON.CHECKSUM_MISMATCH,
          "error",
          "Evidence IR deterministic hash does not match canonical hash material.",
          this.metadata.id,
          {
            expectedDeterministicHash,
            actualDeterministicHash: input.evidenceIR.deterministicHash,
          },
        ),
      );
    }

    const sortedDiagnostics = sortDiagnostics([...input.diagnostics, ...diagnostics]);
    const hasErrors = sortedDiagnostics.some((entry) => entry.severity === "error");
    const hasWarnings = sortedDiagnostics.some((entry) => entry.severity === "warning");

    const attestation: CanonicalEvidenceAttestation = {
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      gps0001Version: gps0001Version ?? "unknown",
      gps0002Version: gps0002Version ?? "unknown",
      verificationStatus: hasErrors ? "failed" : hasWarnings ? "verified-with-gaps" : "verified",
      verifiedChecks: [
        "evidence-ir-checksum",
        "identity-format-audit",
        "canonical-metadata-declarations",
        "nondeterministic-metadata-audit",
      ].sort(),
      diagnostics: sortedDiagnostics,
      checksumReferences: [input.evidenceIR.deterministicHash, ...input.evidenceReferences.map((entry) => entry.evidenceChecksum ?? "")]
        .filter((entry) => entry.length > 0)
        .sort(),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      passHistory: [
        ...input.passHistory,
        {
          passId: this.metadata.id,
          version: this.metadata.version,
          status: hasErrors ? "failed" : "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      validatedEvidence: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: attestation,
      diagnostics: sortedDiagnostics,
      fatal: hasErrors,
    };
  }
}
