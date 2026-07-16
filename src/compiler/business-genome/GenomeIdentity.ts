import { stableStringify } from "../core/stableStringify";
import { SourceHash } from "../provenance/SourceHash";
import type { GenomeIdentity } from "./BusinessGenomeIR";

export class GenomeIdentityFactory {
  static generate(params: {
    kind: string;
    objectType: string;
    enterpriseScope: string;
    relationshipScope: string;
    temporalScope: string;
    lineageSignature: string;
    versionSemantics: string;
    canonicalSemanticContent: unknown;
  }): GenomeIdentity {
    const canonicalPayload = {
      kind: params.kind,
      objectType: params.objectType,
      enterpriseScope: params.enterpriseScope,
      relationshipScope: params.relationshipScope,
      temporalScope: params.temporalScope,
      lineageSignature: params.lineageSignature,
      versionSemantics: params.versionSemantics,
      canonicalSemanticContent: params.canonicalSemanticContent,
    };

    const hash = SourceHash.sha256(stableStringify(canonicalPayload));

    return {
      id: `genome_${params.kind}_${hash}_v1`,
      kind: params.kind,
      objectType: params.objectType,
      enterpriseScope: params.enterpriseScope,
      relationshipScope: params.relationshipScope,
      temporalScope: params.temporalScope,
      lineageSignature: params.lineageSignature,
      versionSemantics: params.versionSemantics,
    };
  }

  static isValid(identity: string): boolean {
    return /^genome_[a-z_]+_[a-f0-9]{64}_v1$/.test(identity);
  }
}
