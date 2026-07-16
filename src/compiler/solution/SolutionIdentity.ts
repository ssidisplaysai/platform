import { createHash } from "node:crypto";
import { stableStringify } from "../core/stableStringify";
import type { SolutionIdentity } from "./SolutionIR";

export interface SolutionIdentityInput {
  kind: string;
  objectType: string;
  sourceBlueprintIdentity: string;
  canonicalSemanticPayload: unknown;
  versionSemantics: string;
}

export class SolutionIdentityFactory {
  static generate(input: SolutionIdentityInput): SolutionIdentity {
    const semanticPayload = stableStringify({
      sourceBlueprintIdentity: input.sourceBlueprintIdentity,
      payload: input.canonicalSemanticPayload,
      versionSemantics: input.versionSemantics,
    });
    const semanticHash = createHash("sha256").update(semanticPayload).digest("hex");

    return {
      id: `sol-${semanticHash}`,
      kind: input.kind,
      objectType: input.objectType,
      sourceBlueprintIdentity: input.sourceBlueprintIdentity,
      semanticHash,
      versionSemantics: input.versionSemantics,
    };
  }

  static isValid(id: string): boolean {
    return /^sol-[a-f0-9]{64}$/.test(id);
  }
}
