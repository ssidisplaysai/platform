import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "./stableStringify";
import type { CompilerArtifact } from "./types";

export class CompilerArtifactManager {
  private readonly artifacts = new Map<string, CompilerArtifact>();

  register(
    type: string,
    version: string,
    sessionId: string,
    producedByPassId: string,
    payload: unknown,
    inputArtifactIds: string[] = [],
    metadata: Record<string, unknown> = {},
    createdAt: string = new Date().toISOString(),
  ): CompilerArtifact {
    const checksum = SourceHash.sha256(stableStringify(payload));
    const id = `${type}:${checksum.slice(0, 24)}`;

    if (this.artifacts.has(id)) {
      return this.artifacts.get(id)!;
    }

    const artifact: CompilerArtifact = {
      id,
      type,
      version,
      checksum,
      createdAt,
      sessionId,
      producedByPassId,
      inputArtifactIds: [...inputArtifactIds].sort(),
      metadata,
    };

    this.artifacts.set(id, artifact);
    return artifact;
  }

  list(): CompilerArtifact[] {
    return [...this.artifacts.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  resolve(id: string): CompilerArtifact {
    const artifact = this.artifacts.get(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }

    return artifact;
  }
}
