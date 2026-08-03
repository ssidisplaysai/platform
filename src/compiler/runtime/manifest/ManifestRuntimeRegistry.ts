import { deepFreeze } from "../foundation/immutability";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type {
  ManifestRuntimeCreateOptions,
  ManifestRuntimeRegistryOptions,
  RegisteredManifestRuntime,
} from "./contracts";

export class ManifestRuntimeRegistry {
  private readonly factory: ManifestRuntimeRegistryOptions["factory"];

  private readonly rules: ManifestRuntimeRegistryOptions["rules"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredManifestRuntime>();

  public constructor(options: ManifestRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.rules = deepFreeze([...(options.rules ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(
    sourceRecords: readonly EvidenceValidationRuntimeRecord[],
    createOptions: ManifestRuntimeCreateOptions,
  ): RegisteredManifestRuntime {
    const record = this.factory.createManifestRecord(sourceRecords, this.rules, createOptions);

    const registration: RegisteredManifestRuntime = deepFreeze({
      record,
      sources: deepFreeze([...sourceRecords]),
      registeredAt: this.clock(),
    });

    this.records.set(this.createKey(record.manifestId, record.version.versionId), registration);
    return registration;
  }

  public getByManifestIdAndVersion(manifestId: string, versionId: string): RegisteredManifestRuntime | undefined {
    return this.records.get(this.createKey(manifestId, versionId));
  }

  public listAll(): readonly RegisteredManifestRuntime[] {
    return deepFreeze(
      [...this.records.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
    );
  }

  public deleteByManifestIdAndVersion(manifestId: string, versionId: string): boolean {
    return this.records.delete(this.createKey(manifestId, versionId));
  }

  public count(): number {
    return this.records.size;
  }

  private createKey(manifestId: string, versionId: string): string {
    return `${manifestId}:${versionId}`;
  }
}
