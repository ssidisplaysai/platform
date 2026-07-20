import {
  createArtifactDisplayId,
  createArtifactUuid,
} from "./artifact-id";
import { ArtifactStore } from "./artifact-store";
import {
  ArtifactValidator,
  type ArtifactValidationResult,
} from "./artifact-validator";
import {
  LocalArtifactRepository,
  type ArtifactRepository,
} from "./artifact-repository";
import { normalizeArtifactMetadata } from "./artifact-metadata";
import type {
  ArtifactSummary,
  CreateArtifactRequest,
  GenesisArtifact,
} from "./artifact-types";

const DEFAULT_ARTIFACT_VERSION = "1.0.0";

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }

  return value;
}

export class ArtifactManager {
  public constructor(
    private readonly repository: ArtifactRepository,
    private readonly validator: ArtifactValidator = new ArtifactValidator(),
  ) {}

  public static createLocal(rootPath: string): ArtifactManager {
    return new ArtifactManager(
      new LocalArtifactRepository(new ArtifactStore(rootPath)),
    );
  }

  public hash(value: unknown): string {
    return this.validator.hash(value);
  }

  public async create<TPayload>(
    request: CreateArtifactRequest<TPayload>,
  ): Promise<GenesisArtifact<TPayload>> {
    const createdAt = new Date().toISOString();
    const id = createArtifactUuid(request.deterministicSeed);
    const displayId = createArtifactDisplayId(
      await this.repository.getNextSequence(),
    );
    const sha256 = this.hash(request.payload);
    const dependencies = [...(request.dependencies ?? [])];
    const parentArtifacts = [...(request.parentArtifacts ?? [])];
    const metadata = normalizeArtifactMetadata(request.metadata);

    const artifact: GenesisArtifact<TPayload> = {
      id,
      displayId,
      type: request.type,
      version:
        request.version?.trim() || DEFAULT_ARTIFACT_VERSION,
      compilerId: request.compilerId,
      compilerVersion: request.compilerVersion,
      runtimeVersion: request.runtimeVersion,
      sha256,
      createdAt,
      manifest: {
        artifactId: id,
        displayId,
        artifactType: request.type,
        compiler: {
          id: request.compilerId,
          version: request.compilerVersion,
        },
        runtime: {
          version: request.runtimeVersion,
        },
        createdAt,
        inputSummary: { ...(request.inputSummary ?? {}) },
        outputSummary: { ...(request.outputSummary ?? {}) },
        dependencyCount: dependencies.length,
        parentCount: parentArtifacts.length,
        sha256,
      },
      metadata,
      dependencies,
      parentArtifacts,
      lineage: {
        parentArtifacts,
        sourceCompiler: request.compilerId,
        sourceRuntime: request.runtimeVersion,
        createdAt,
      },
      status: request.status ?? "ACTIVE",
      payload: request.payload,
    };

    return deepFreeze(artifact);
  }

  public async save<TPayload>(
    artifact: GenesisArtifact<TPayload>,
  ): Promise<void> {
    const validation = this.validator.validate(artifact);

    if (!validation.valid) {
      throw new Error(
        `Artifact '${artifact.id}' is invalid: ${validation.errors.join(" ")}`,
      );
    }

    await this.repository.save(artifact);
  }

  public async load<TPayload>(
    artifactId: string,
  ): Promise<GenesisArtifact<TPayload> | null> {
    return this.repository.load(artifactId);
  }

  public async exists(artifactId: string): Promise<boolean> {
    return this.repository.exists(artifactId);
  }

  public async validate(
    artifactOrId: GenesisArtifact | string,
  ): Promise<ArtifactValidationResult> {
    if (typeof artifactOrId !== "string") {
      return this.validator.validate(artifactOrId);
    }

    const artifact = await this.load(artifactOrId);

    if (!artifact) {
      return {
        valid: false,
        errors: [`Artifact '${artifactOrId}' was not found.`],
      };
    }

    return this.validator.validate(artifact);
  }

  public async list(): Promise<readonly ArtifactSummary[]> {
    return this.repository.list();
  }

  public getPayloadPath(artifactId: string): string {
    return this.repository.getPayloadPath(artifactId);
  }
}

export function resolveArtifactRoot(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const artifactRoot = environment.GENESIS_ARTIFACT_ROOT?.trim();

  if (!artifactRoot) {
    throw new Error("GENESIS_ARTIFACT_ROOT is not configured.");
  }

  return artifactRoot;
}
