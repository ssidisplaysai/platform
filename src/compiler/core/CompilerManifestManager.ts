import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "./stableStringify";
import type { CompilerDiagnostic, CompilerManifest, CompilerPassMetadata } from "./types";

interface BuildManifestInput {
  sessionId: string;
  compilerVersion: string;
  pipelineVersion: string;
  passManifests: readonly CompilerPassMetadata[];
  artifactIds: readonly string[];
  diagnostics: readonly CompilerDiagnostic[];
  startedAt: string;
  completedAt: string;
  sourceManifest: {
    sourceType: string;
    sourceId: string;
  };
  standards: CompilerManifest["standards"];
}

export class CompilerManifestManager {
  buildManifest(input: BuildManifestInput): CompilerManifest {
    const normalizedPasses = [...input.passManifests].sort((a, b) => a.id.localeCompare(b.id));
    const normalizedArtifactIds = [...input.artifactIds].sort();

    const hashMaterial = {
      schemaVersion: "1.0.0" as const,
      sessionId: input.sessionId,
      compilerVersion: input.compilerVersion,
      pipelineVersion: input.pipelineVersion,
      passManifests: normalizedPasses,
      artifactIds: normalizedArtifactIds,
      diagnostics: [...input.diagnostics],
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      sourceManifest: input.sourceManifest,
      standards: input.standards,
    };

    const checksum = SourceHash.sha256(stableStringify(hashMaterial));

    return Object.freeze({
      ...hashMaterial,
      checksum,
    });
  }
}
