import { deepFreeze } from "../foundation/immutability";
import type { ReplayRuntimeCreateOptions, ReplayRuntimeCreateInput, ReplayRuntimeRegistryOptions, RegisteredReplayRuntime } from "./contracts";
import { ReplayRuntimeFactory } from "./ReplayRuntimeFactory";

export class ReplayRuntimeRegistry {
  private readonly factory: ReplayRuntimeRegistryOptions["factory"];

  private readonly rules: ReplayRuntimeRegistryOptions["rules"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredReplayRuntime>();

  public constructor(options: ReplayRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.rules = deepFreeze([...(options.rules ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(input: ReplayRuntimeCreateInput, createOptions: ReplayRuntimeCreateOptions): RegisteredReplayRuntime {
    const record = this.factory.createReplayRecord(input, this.rules, createOptions);

    const registration: RegisteredReplayRuntime = deepFreeze({
      record,
      manifest: input.manifest,
      validationRecords: deepFreeze([...input.validationRecords]),
      evidenceObjects: deepFreeze([...input.evidenceObjects]),
      registeredAt: this.clock(),
    });

    this.records.set(this.createKey(record.replayId, record.version.versionId), registration);
    return registration;
  }

  public getByReplayIdAndVersion(replayId: string, versionId: string): RegisteredReplayRuntime | undefined {
    return this.records.get(this.createKey(replayId, versionId));
  }

  public listAll(): readonly RegisteredReplayRuntime[] {
    return deepFreeze(
      [...this.records.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
    );
  }

  public deleteByReplayIdAndVersion(replayId: string, versionId: string): boolean {
    return this.records.delete(this.createKey(replayId, versionId));
  }

  public count(): number {
    return this.records.size;
  }

  private createKey(replayId: string, versionId: string): string {
    return `${replayId}:${versionId}`;
  }
}