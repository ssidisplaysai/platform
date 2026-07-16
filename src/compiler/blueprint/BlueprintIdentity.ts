import { createHash } from "node:crypto";
import { stableStringify } from "../core/stableStringify";
import type { BlueprintIdentity } from "./BlueprintIR";

export interface BlueprintIdentityInput {
  kind: string;
  objectType: string;
  enterpriseScope: string;
  domainScope: string;
  moduleScope: string;
  parentRelationships: readonly string[];
  temporalScope: string;
  lineageSignature: string;
  versionSemantics: string;
  canonicalSemanticContent: unknown;
}

function normalize(input: BlueprintIdentityInput): string {
  return stableStringify({
    kind: input.kind,
    objectType: input.objectType,
    enterpriseScope: input.enterpriseScope,
    domainScope: input.domainScope,
    moduleScope: input.moduleScope,
    parentRelationships: [...input.parentRelationships].sort((a, b) => a.localeCompare(b)),
    temporalScope: input.temporalScope,
    lineageSignature: input.lineageSignature,
    versionSemantics: input.versionSemantics,
    canonicalSemanticContent: input.canonicalSemanticContent,
  });
}

export class BlueprintIdentityFactory {
  static generate(input: BlueprintIdentityInput): BlueprintIdentity {
    const hash = createHash("sha256").update(normalize(input)).digest("hex");

    return {
      id: `bp-${hash}`,
      kind: input.kind,
      objectType: input.objectType,
      enterpriseScope: input.enterpriseScope,
      domainScope: input.domainScope,
      moduleScope: input.moduleScope,
      parentRelationships: [...input.parentRelationships].sort((a, b) => a.localeCompare(b)),
      temporalScope: input.temporalScope,
      lineageSignature: input.lineageSignature,
      versionSemantics: input.versionSemantics,
    };
  }

  static isValid(id: string): boolean {
    return /^bp-[a-f0-9]{64}$/.test(id);
  }
}
