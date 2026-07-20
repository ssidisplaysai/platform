import type { ArtifactManifest } from "./artifact-manifest";
import type { ArtifactMetadata } from "./artifact-metadata";
import type {
  ArtifactSummary,
  GenesisArtifact,
} from "./artifact-types";
import { ArtifactStore } from "./artifact-store";

interface StoredArtifactRecord {
  readonly id: string;
  readonly displayId: string;
  readonly type: string;
  readonly version: string;
  readonly compilerId: string;
  readonly compilerVersion: string;
  readonly runtimeVersion: string;
  readonly sha256: string;
  readonly createdAt: string;
  readonly status: GenesisArtifact["status"];
  readonly dependencies: GenesisArtifact["dependencies"];
  readonly parentArtifacts: readonly string[];
  readonly lineage: GenesisArtifact["lineage"];
  readonly manifest: ArtifactManifest;
}

export interface ArtifactRepository {
  save<TPayload>(artifact: GenesisArtifact<TPayload>): Promise<void>;
  load<TPayload>(artifactId: string): Promise<GenesisArtifact<TPayload> | null>;
  exists(artifactId: string): Promise<boolean>;
  list(): Promise<readonly ArtifactSummary[]>;
  getNextSequence(): Promise<number>;
  getPayloadPath(artifactId: string): string;
}

export class LocalArtifactRepository
  implements ArtifactRepository
{
  public constructor(private readonly store: ArtifactStore) {}

  public async save<TPayload>(
    artifact: GenesisArtifact<TPayload>,
  ): Promise<void> {
    await this.store.ensureRoot();

    const artifactPath = this.store.getArtifactPath(artifact.id);

    if (await this.store.exists(artifactPath)) {
      throw new Error(
        `Artifact '${artifact.id}' already exists.`,
      );
    }

    await this.store.ensureArtifactDirectory(artifact.id);

    const record: StoredArtifactRecord = {
      id: artifact.id,
      displayId: artifact.displayId,
      type: artifact.type,
      version: artifact.version,
      compilerId: artifact.compilerId,
      compilerVersion: artifact.compilerVersion,
      runtimeVersion: artifact.runtimeVersion,
      sha256: artifact.sha256,
      createdAt: artifact.createdAt,
      status: artifact.status,
      dependencies: artifact.dependencies,
      parentArtifacts: artifact.parentArtifacts,
      lineage: artifact.lineage,
      manifest: artifact.manifest,
    };

    await this.store.writeJson(
      this.store.getManifestPath(artifact.id),
      record,
    );

    await this.store.writeJson(
      this.store.getMetadataPath(artifact.id),
      artifact.metadata,
    );

    await this.store.writeJson(
      this.store.getPayloadPath(artifact.id),
      artifact.payload,
    );
  }

  public async load<TPayload>(
    artifactId: string,
  ): Promise<GenesisArtifact<TPayload> | null> {
    const manifestPath = this.store.getManifestPath(artifactId);
    const metadataPath = this.store.getMetadataPath(artifactId);
    const payloadPath = this.store.getPayloadPath(artifactId);

    const hasAllFiles =
      (await this.store.exists(manifestPath)) &&
      (await this.store.exists(metadataPath)) &&
      (await this.store.exists(payloadPath));

    if (!hasAllFiles) {
      return null;
    }

    const stored =
      await this.store.readJson<StoredArtifactRecord>(manifestPath);
    const metadata = await this.store.readJson<ArtifactMetadata>(metadataPath);
    const payload = await this.store.readJson<TPayload>(payloadPath);

    return {
      id: stored.id || artifactId,
      displayId: stored.displayId || stored.manifest.displayId,
      type: stored.type || stored.manifest.artifactType,
      version: stored.version || "1.0.0",
      compilerId: stored.compilerId || stored.manifest.compiler.id,
      compilerVersion:
        stored.compilerVersion || stored.manifest.compiler.version,
      runtimeVersion:
        stored.runtimeVersion || stored.manifest.runtime.version,
      sha256: stored.sha256 || stored.manifest.sha256,
      createdAt: stored.createdAt || stored.manifest.createdAt,
      manifest: stored.manifest,
      metadata,
      dependencies: stored.dependencies ?? [],
      parentArtifacts: stored.parentArtifacts ?? [],
      lineage: stored.lineage ?? {
        parentArtifacts: [],
        sourceCompiler: stored.compilerId || "unknown",
        sourceRuntime: stored.runtimeVersion || "unknown",
        createdAt: stored.createdAt || new Date().toISOString(),
      },
      status: stored.status ?? "ACTIVE",
      payload,
    };
  }

  public async exists(artifactId: string): Promise<boolean> {
    return this.store.exists(this.store.getArtifactPath(artifactId));
  }

  public async list(): Promise<readonly ArtifactSummary[]> {
    const artifactIds = await this.store.listArtifactIds();
    const loaded = await Promise.all(
      artifactIds.map((artifactId) => this.load(artifactId)),
    );

    return loaded
      .filter((artifact): artifact is GenesisArtifact => !!artifact)
      .map((artifact) => ({
        id: artifact.id,
        displayId: artifact.displayId,
        type: artifact.type,
        version: artifact.version,
        compilerId: artifact.compilerId,
        compilerVersion: artifact.compilerVersion,
        runtimeVersion: artifact.runtimeVersion,
        createdAt: artifact.createdAt,
        sha256: artifact.sha256,
        status: artifact.status,
      }))
      .sort((left, right) =>
        left.displayId.localeCompare(right.displayId),
      );
  }

  public async getNextSequence(): Promise<number> {
    const summaries = await this.list();

    if (!summaries.length) {
      return 1;
    }

    const sequence = summaries.reduce((maximum, summary) => {
      const numeric = Number(summary.displayId.replace(/^ART-/, ""));
      return Number.isFinite(numeric) && numeric > maximum
        ? numeric
        : maximum;
    }, 0);

    return sequence + 1;
  }

  public getPayloadPath(artifactId: string): string {
    return this.store.getPayloadPath(artifactId);
  }
}
