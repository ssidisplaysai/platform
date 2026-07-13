import type { CompilerDiagnostic, CompilerDiagnosticSeverity } from "../core/types";

export const BGC_DIAGNOSTIC_CODES = {
  INPUT: {
    MISSING_INPUT: "BGC-INPUT-001",
    MISSING_EVIDENCE_IR_IDENTITY: "BGC-INPUT-002",
    INVALID_EVIDENCE_IR_SCHEMA_VERSION: "BGC-INPUT-003",
    MISSING_UPSTREAM_VALIDATION_STATUS: "BGC-INPUT-004",
    UPSTREAM_VALIDATION_FAILED: "BGC-INPUT-005",
    MISSING_EVIDENCE_COLLECTION: "BGC-INPUT-006",
    INVALID_EVIDENCE_ITEM_IDENTITY: "BGC-INPUT-007",
    MISSING_PROVENANCE_REFERENCE: "BGC-INPUT-008",
    DUPLICATE_EVIDENCE_IDENTITY: "BGC-INPUT-009",
    MISSING_CANONICAL_METADATA: "BGC-INPUT-010",
    UNRESOLVED_SOURCE_REFERENCE: "BGC-INPUT-011",
  },
  CANON: {
    MISSING_GPS_VERSION: "BGC-CANON-001",
    INVALID_CANONICAL_IDENTITY_FORMAT: "BGC-CANON-002",
    MISSING_CANONICALIZATION_VERSION: "BGC-CANON-003",
    NONDETERMINISTIC_METADATA: "BGC-CANON-004",
    MISSING_CHECKSUM_REFERENCE: "BGC-CANON-005",
    MISSING_CANONICAL_VALIDATION_STATUS: "BGC-CANON-006",
    CHECKSUM_MISMATCH: "BGC-CANON-007",
  },
  GROUP: {
    EMPTY_EVIDENCE_SET: "BGC-GROUP-001",
    DUPLICATE_GROUP_ASSIGNMENT: "BGC-GROUP-002",
    EVIDENCE_PRESERVATION_MISMATCH: "BGC-GROUP-003",
  },
  CORR: {
    NO_GROUPS_TO_CORRELATE: "BGC-CORR-001",
    CROSS_CLUSTER_CONFLICT_DETECTED: "BGC-CORR-002",
    DUPLICATE_CLUSTER_ASSIGNMENT: "BGC-CORR-003",
    EVIDENCE_PRESERVATION_MISMATCH: "BGC-CORR-004",
  },
  SEM: {
    UNSUPPORTED_SEMANTIC_CLASSIFICATION: "BGC-SEM-001",
    INSUFFICIENT_EXPLICIT_EVIDENCE: "BGC-SEM-002",
    CONFLICTING_SEMANTIC_CLASSIFICATIONS: "BGC-SEM-003",
    MISSING_PROVENANCE: "BGC-SEM-004",
    INVALID_SEMANTIC_CLASS: "BGC-SEM-005",
    CANDIDATE_IDENTITY_FAILURE: "BGC-SEM-006",
  },
  CONS: {
    CONSOLIDATION_APPLIED: "BGC-CONS-001",
    CONSOLIDATION_PREVENTED_BY_CONFLICT: "BGC-CONS-002",
    CONSOLIDATION_PREVENTED_BY_CLASS_MISMATCH: "BGC-CONS-003",
    CONSOLIDATION_PREVENTED_BY_DESIGNATION_MISMATCH: "BGC-CONS-004",
  },
  PIPELINE: {
    PASS_CONTRACT_VALIDATION_FAILED: "BGC-PIPELINE-001",
    PASS_EXECUTION_FAILED: "BGC-PIPELINE-002",
    MISSING_REQUIRED_PASS_OUTPUT: "BGC-PIPELINE-003",
  },
} as const;

export function createDiagnostic(
  code: string,
  severity: CompilerDiagnosticSeverity,
  message: string,
  passId: string,
  details?: Readonly<Record<string, unknown>>,
  artifactId?: string,
): CompilerDiagnostic {
  return {
    code,
    severity,
    message,
    passId,
    artifactId,
    details: details ? { ...details } : undefined,
  };
}

export function sortDiagnostics(diagnostics: readonly CompilerDiagnostic[]): CompilerDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }

    const passCompare = (a.passId ?? "").localeCompare(b.passId ?? "");
    if (passCompare !== 0) {
      return passCompare;
    }

    const artifactCompare = (a.artifactId ?? "").localeCompare(b.artifactId ?? "");
    if (artifactCompare !== 0) {
      return artifactCompare;
    }

    return a.message.localeCompare(b.message);
  });
}
