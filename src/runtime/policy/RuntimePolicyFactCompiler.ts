import type {
  RuntimePolicyDiagnostic,
  RuntimePolicyEvidenceEntry,
  RuntimePolicyFact,
  RuntimePolicyFactCompilationResult,
  RuntimePolicyFactIR,
  RuntimePolicyFactType,
} from "./types";
import {
  createDigest,
  deepFreeze,
  normalizeConfidence,
  stablePrimitiveRecord,
  stableSerialize,
  stableStringArray,
} from "./types";

export class RuntimePolicyFactCompilationError extends Error {
  constructor(
    public readonly code: string,
    public readonly factKey: string,
    public readonly factType: string,
    public readonly failureReason: string,
    public readonly diagnostic: RuntimePolicyDiagnostic,
    public readonly evidence: RuntimePolicyEvidenceEntry,
  ) {
    super(`${code}: ${failureReason}`);
  }
}

const SUPPORTED_FACT_TYPES: readonly RuntimePolicyFactType[] = Object.freeze(["String", "Number", "Boolean", "Null", "Json"]);

export class RuntimePolicyFactCompiler {
  compile(fact: RuntimePolicyFact, schemaVersion: string): RuntimePolicyFactCompilationResult {
    const diagnostics: RuntimePolicyDiagnostic[] = [];
    const evidence: RuntimePolicyEvidenceEntry[] = [];

    if (!SUPPORTED_FACT_TYPES.includes(fact.factType)) {
      const diagnostic = deepFreeze({
        sequence: diagnostics.length + 1,
        level: "Error" as const,
        code: "GRT-POL-FACT-001",
        message: "Unsupported runtime policy fact type.",
        details: deepFreeze({
          factKey: fact.factKey,
          factType: fact.factType,
        }),
      });
      diagnostics.push(diagnostic);

      const evidenceEntry = deepFreeze({
        sequence: evidence.length + 1,
        type: "FactRejected",
        details: deepFreeze({
          code: diagnostic.code,
          factKey: fact.factKey,
          factType: fact.factType,
        }),
      });
      evidence.push(evidenceEntry);

      throw new RuntimePolicyFactCompilationError(
        diagnostic.code,
        fact.factKey,
        fact.factType,
        "Unsupported runtime policy fact type.",
        diagnostic,
        evidenceEntry,
      );
    }

    const canonicalValue = this.canonicalValue(fact);
    const provenanceReferences = stableStringArray(fact.provenanceReferences ?? []);
    const provenance = deepFreeze({
      sourceKind: fact.sourceKind,
      sourceId: fact.sourceId,
      sourceVersion: fact.sourceVersion,
      sourceDigest: fact.sourceDigest,
      provenanceReferences,
    });
    const provenanceDigest = createDigest({
      provenance,
      metadata: stablePrimitiveRecord(fact.metadata ?? {}),
    });

    const factDigest = createDigest({
      factKey: fact.factKey,
      canonicalType: fact.factType,
      canonicalValue,
      sourceDigest: fact.sourceDigest,
      provenanceDigest,
    });

    const factIr: RuntimePolicyFactIR = deepFreeze({
      factId: `fact-ir-${factDigest.slice(0, 16)}`,
      factKey: fact.factKey,
      canonicalType: fact.factType,
      canonicalValue,
      provenance,
      sourceDigest: fact.sourceDigest,
      provenanceDigest,
      confidence: normalizeConfidence(fact.confidence),
      schemaVersion,
    });

    evidence.push(deepFreeze({
      sequence: evidence.length + 1,
      type: "FactCanonicalized",
      details: deepFreeze({
        factKey: fact.factKey,
        factId: factIr.factId,
        canonicalDigest: createDigest(stableSerialize(canonicalValue)),
      }),
    }));

    return deepFreeze({
      factIr,
      diagnostics: Object.freeze(diagnostics),
      evidence: Object.freeze(evidence),
    });
  }

  compileMany(facts: readonly RuntimePolicyFact[], schemaVersion: string): readonly RuntimePolicyFactIR[] {
    return Object.freeze(
      facts
        .map((fact) => this.compile(fact, schemaVersion).factIr)
        .sort((a, b) => a.factId.localeCompare(b.factId)),
    );
  }

  private canonicalValue(fact: RuntimePolicyFact): unknown {
    const { factType: type, factValue: value, factKey } = fact;
    if (type === "String") {
      if (typeof value !== "string") {
        throw this.valueError(factKey, type, "String fact values must be strings.");
      }
      return String(value);
    }
    if (type === "Number") {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw this.valueError(factKey, type, "Number fact values must be finite numbers.");
      }
      return value;
    }
    if (type === "Boolean") {
      if (typeof value !== "boolean") {
        throw this.valueError(factKey, type, "Boolean fact values must be booleans.");
      }
      return Boolean(value);
    }
    if (type === "Null") {
      if (value !== null) {
        throw this.valueError(factKey, type, "Null fact values must be null.");
      }
      return null;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw this.valueError(factKey, type, "Json fact values must be canonical objects.");
    }
    return JSON.parse(stableSerialize(value));
  }

  private valueError(factKey: string, factType: RuntimePolicyFactType, failureReason: string): RuntimePolicyFactCompilationError {
    const diagnostic = deepFreeze({
      sequence: 1,
      level: "Error" as const,
      code: "GRT-POL-FACT-002",
      message: "Unsupported runtime policy fact value.",
      details: deepFreeze({
        factKey,
        factType,
        failureReason,
      }),
    });

    const evidence = deepFreeze({
      sequence: 1,
      type: "FactRejected",
      details: deepFreeze({
        code: diagnostic.code,
        factKey,
        factType,
        failureReason,
      }),
    });

    return new RuntimePolicyFactCompilationError(
      diagnostic.code,
      factKey,
      factType,
      failureReason,
      diagnostic,
      evidence,
    );
  }
}
