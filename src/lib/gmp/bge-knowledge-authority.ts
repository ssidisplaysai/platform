import { createHash } from "node:crypto";
import { deriveBgeConfidenceFromEvidenceSignals, normalizeBusinessGenomePayload } from "./evidence-services";

export type BgeKnowledgeAuthority = {
  authority: "gmp";
  normalizePayload: (payload: Record<string, unknown>) => {
    normalizedPayload: Record<string, unknown>;
    normalizationVersion: string;
  };
  deriveConfidence: (input: { evidenceCount: number; sourceAgreement?: number; publicationMatches?: number }) => {
    confidenceScore: number;
    confidenceLevel: string;
    confidenceVersion: string;
  };
  retrieveKnowledge: (input: {
    tenantId: string;
    objectType: string;
    objectId: string;
    payload: Record<string, unknown>;
  }) => {
    authority: "gmp";
    status: "UNAVAILABLE_WITHOUT_PROJECT_CONTEXT";
    retrievalFingerprint: string;
  };
};

function stableFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createBgeKnowledgeAuthority(): BgeKnowledgeAuthority {
  return {
    authority: "gmp",
    normalizePayload(payload) {
      return {
        normalizedPayload: normalizeBusinessGenomePayload(payload),
        normalizationVersion: "gmp-bge-normalization/v1",
      };
    },
    deriveConfidence(input) {
      return deriveBgeConfidenceFromEvidenceSignals(input);
    },
    retrieveKnowledge(input) {
      return {
        authority: "gmp",
        status: "UNAVAILABLE_WITHOUT_PROJECT_CONTEXT",
        retrievalFingerprint: stableFingerprint(input),
      };
    },
  };
}