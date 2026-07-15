import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "./stableStringify";
import type { CompilerArtifact } from "./types";

export class ArtifactRegistry {
  private readonly artifacts = new Map<string, CompilerArtifact>();

  register(
    type: string,
    version: string,
    sessionId: string,
    producedByPassId: string,
    payload: unknown,
    inputArtifactIds: readonly string[] = [],
    metadata: Readonly<Record<string, unknown>> = {},
    createdAt: string = new Date().toISOString(),
  ): CompilerArtifact {
    const checksum = SourceHash.sha256(stableStringify(payload));
    const id = `${type}:${checksum.slice(0, 24)}`;

    const existing = this.artifacts.get(id);
    if (existing) {
      return existing;
    }

    const artifact: CompilerArtifact = Object.freeze({
      id,
      type,
      version,
      checksum,
      createdAt,
      sessionId,
      producedByPassId,
      inputArtifactIds: [...inputArtifactIds].sort(),
      metadata: Object.freeze({ ...metadata }),
      payload,
    });

    this.artifacts.set(id, artifact);
    return artifact;
  }

  list(): readonly CompilerArtifact[] {
    return [...this.artifacts.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  resolve(id: string): CompilerArtifact {
    const artifact = this.artifacts.get(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }

    return artifact;
  }
}