import { createHash } from "node:crypto";
import { stableStringify } from "../core/stableStringify";
import type { RuntimeIdentity } from "./EnterpriseRuntimeIR";

export interface RuntimeIdentityInput {
  kind: string;
  objectType: string;
  sourceSolutionIdentity: string;
  canonicalSemanticPayload: unknown;
  parentIdentity?: string;
  environmentScope?: string;
  deploymentScope?: string;
  lineageSignature: string;
  versionSemantics: string;
}

export class RuntimeIdentityFactory {
  static generate(input: RuntimeIdentityInput): RuntimeIdentity {
    const semanticPayload = stableStringify({
      sourceSolutionIdentity: input.sourceSolutionIdentity,
      payload: input.canonicalSemanticPayload,
      parentIdentity: input.parentIdentity ?? null,
      environmentScope: input.environmentScope ?? null,
      deploymentScope: input.deploymentScope ?? null,
      lineageSignature: input.lineageSignature,
      versionSemantics: input.versionSemantics,
    });

    const semanticHash = createHash("sha256").update(semanticPayload).digest("hex");

    return {
      id: `run-${semanticHash}`,
      kind: input.kind,
      objectType: input.objectType,
      sourceSolutionIdentity: input.sourceSolutionIdentity,
      semanticHash,
      parentIdentity: input.parentIdentity,
      environmentScope: input.environmentScope,
      deploymentScope: input.deploymentScope,
      lineageSignature: input.lineageSignature,
      versionSemantics: input.versionSemantics,
    };
  }

  static isValid(id: string): boolean {
    return /^run-[a-f0-9]{64}$/.test(id);
  }
}
