import { deepFreeze } from "../foundation/immutability";
import type { IBRRuntimeCreateInput, IBRRuntimeCreateOptions, IBRRuntimeRegistryOptions, RegisteredIBRRuntime } from "./contracts";
import { IBRRuntimeFactory } from "./IBRRuntimeFactory";

export class IBRRuntimeRegistry {
  private readonly factory: IBRRuntimeRegistryOptions["factory"];

  private readonly rules: IBRRuntimeRegistryOptions["rules"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredIBRRuntime>();

  public constructor(options: IBRRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.rules = deepFreeze([...(options.rules ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(input: IBRRuntimeCreateInput, createOptions: IBRRuntimeCreateOptions): RegisteredIBRRuntime {
    const record = this.factory.createIBRRecord(input, this.rules, createOptions);

    const registration: RegisteredIBRRuntime = deepFreeze({
      record,
      manifest: input.manifest,
      replayRecord: input.replayRecord,
      validationRecords: deepFreeze([...input.validationRecords]),
      evidenceObjects: deepFreeze([...input.evidenceObjects]),
      registeredAt: this.clock(),
    });

    this.records.set(this.createKey(record.ibrId, record.version.versionId), registration);
    return registration;
  }

  public getByIbrIdAndVersion(ibrId: string, versionId: string): RegisteredIBRRuntime | undefined {
    return this.records.get(this.createKey(ibrId, versionId));
  }

  public listAll(): readonly RegisteredIBRRuntime[] {
    return deepFreeze(
      [...this.records.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
    );
  }

  public deleteByIbrIdAndVersion(ibrId: string, versionId: string): boolean {
    return this.records.delete(this.createKey(ibrId, versionId));
  }

  public count(): number {
    return this.records.size;
  }

  private createKey(ibrId: string, versionId: string): string {
    return `${ibrId}:${versionId}`;
  }
}
