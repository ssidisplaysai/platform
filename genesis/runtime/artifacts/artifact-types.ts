import type { ArtifactStatus } from "./artifact-lifecycle";
import type {
  ArtifactMetadata,
  ArtifactMetadataInput,
} from "./artifact-metadata";
import type { ArtifactManifest } from "./artifact-manifest";

export interface ArtifactDependencyReference {
  readonly id: string;
  readonly type: string;
  readonly relation: string;
}

export interface ArtifactLineage {
  readonly parentArtifacts: readonly string[];
  readonly sourceCompiler: string;
  readonly sourceRuntime: string;
  readonly createdAt: string;
}

export interface GenesisArtifact<TPayload = unknown> {
  readonly id: string;
  readonly displayId: string;
  readonly type: string;
  readonly version: string;
  readonly compilerId: string;
  readonly compilerVersion: string;
  readonly runtimeVersion: string;
  readonly sha256: string;
  readonly createdAt: string;
  readonly manifest: ArtifactManifest;
  readonly metadata: ArtifactMetadata;
  readonly dependencies: readonly ArtifactDependencyReference[];
  readonly parentArtifacts: readonly string[];
  readonly lineage: ArtifactLineage;
  readonly status: ArtifactStatus;
  readonly payload: TPayload;
}

export interface ArtifactSummary {
  readonly id: string;
  readonly displayId: string;
  readonly type: string;
  readonly version: string;
  readonly compilerId: string;
  readonly compilerVersion: string;
  readonly runtimeVersion: string;
  readonly createdAt: string;
  readonly sha256: string;
  readonly status: ArtifactStatus;
}

export interface CreateArtifactRequest<TPayload = unknown> {
  readonly type: string;
  readonly version: string;
  readonly compilerId: string;
  readonly compilerVersion: string;
  readonly runtimeVersion: string;
  readonly payload: TPayload;
  readonly metadata?: ArtifactMetadataInput;
  readonly dependencies?: readonly ArtifactDependencyReference[];
  readonly parentArtifacts?: readonly string[];
  readonly status?: ArtifactStatus;
  readonly deterministicSeed?: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: Readonly<Record<string, unknown>>;
}
