export interface ArtifactManifest {
  readonly artifactId: string;
  readonly displayId: string;
  readonly artifactType: string;
  readonly compiler: {
    readonly id: string;
    readonly version: string;
  };
  readonly runtime: {
    readonly version: string;
  };
  readonly createdAt: string;
  readonly inputSummary: Readonly<Record<string, unknown>>;
  readonly outputSummary: Readonly<Record<string, unknown>>;
  readonly dependencyCount: number;
  readonly parentCount: number;
  readonly sha256: string;
}
