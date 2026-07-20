export interface ArtifactMetadata {
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly owner: string;
  readonly company: string;
  readonly project: string;
  readonly environment: string;
  readonly customProperties: Readonly<Record<string, unknown>>;
}

export interface ArtifactMetadataInput {
  readonly name?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly labels?: Readonly<Record<string, string>>;
  readonly owner?: string;
  readonly company?: string;
  readonly project?: string;
  readonly environment?: string;
  readonly customProperties?: Readonly<Record<string, unknown>>;
}

export function normalizeArtifactMetadata(
  input: ArtifactMetadataInput | undefined,
): ArtifactMetadata {
  return {
    name: input?.name?.trim() || "Genesis Artifact",
    description: input?.description?.trim() || "",
    tags: [...(input?.tags ?? [])],
    labels: { ...(input?.labels ?? {}) },
    owner: input?.owner?.trim() || "runtime",
    company: input?.company?.trim() || "",
    project: input?.project?.trim() || "",
    environment: input?.environment?.trim() || "development",
    customProperties: { ...(input?.customProperties ?? {}) },
  };
}
