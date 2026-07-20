import type { ArtifactStatus } from "../artifacts";
import type { ArtifactMetadata } from "../artifacts";

export interface ArtifactNode {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly compilerId: string;
  readonly runtimeVersion: string;
  readonly status: ArtifactStatus;
  readonly createdAt: string;
  readonly metadata: ArtifactMetadata;
}
