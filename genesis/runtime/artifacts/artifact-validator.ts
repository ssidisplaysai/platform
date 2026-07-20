import { createHash } from "node:crypto";

import { isArtifactStatus } from "./artifact-lifecycle";
import type { GenesisArtifact } from "./artifact-types";

export interface ArtifactValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  const keys = Object.keys(value as Record<string, unknown>).sort(
    (left, right) => left.localeCompare(right),
  );

  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalize(
          (value as Record<string, unknown>)[key],
        )}`,
    )
    .join(",")}}`;
}

export class ArtifactValidator {
  public hash(value: unknown): string {
    return createHash("sha256")
      .update(canonicalize(value), "utf8")
      .digest("hex");
  }

  public validate<TPayload>(
    artifact: GenesisArtifact<TPayload>,
  ): ArtifactValidationResult {
    const errors: string[] = [];

    if (!artifact.id) {
      errors.push("Artifact id is required.");
    }

    if (!artifact.displayId) {
      errors.push("Artifact displayId is required.");
    }

    if (!artifact.type) {
      errors.push("Artifact type is required.");
    }

    if (!artifact.compilerId) {
      errors.push("Artifact compilerId is required.");
    }

    if (!artifact.runtimeVersion) {
      errors.push("Artifact runtimeVersion is required.");
    }

    if (!isArtifactStatus(artifact.status)) {
      errors.push(`Artifact status '${artifact.status}' is invalid.`);
    }

    if (artifact.manifest.artifactId !== artifact.id) {
      errors.push("Manifest artifactId does not match artifact id.");
    }

    if (artifact.manifest.artifactType !== artifact.type) {
      errors.push("Manifest artifactType does not match artifact type.");
    }

    if (artifact.manifest.sha256 !== artifact.sha256) {
      errors.push("Manifest sha256 does not match artifact sha256.");
    }

    if (!artifact.metadata.name.trim()) {
      errors.push("Artifact metadata name is required.");
    }

    const computedHash = this.hash(artifact.payload);

    if (computedHash !== artifact.sha256) {
      errors.push("Artifact payload sha256 hash mismatch.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
