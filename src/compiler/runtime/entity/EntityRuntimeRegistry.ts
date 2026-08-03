import { deepFreeze } from "../foundation/immutability";
import type {
  EntityRuntimeCreateInput,
  EntityRuntimeCreateOptions,
  EntityRuntimeRegistryOptions,
  RegisteredEntityRuntime,
} from "./contracts";

export class EntityRuntimeRegistry {
  private readonly factory: EntityRuntimeRegistryOptions["factory"];

  private readonly rules: EntityRuntimeRegistryOptions["rules"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredEntityRuntime>();

  public constructor(options: EntityRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.rules = deepFreeze([...(options.rules ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(input: EntityRuntimeCreateInput, createOptions: EntityRuntimeCreateOptions): RegisteredEntityRuntime {
    const record = this.factory.createEntityRecord(input, this.rules, createOptions);

    const registration: RegisteredEntityRuntime = deepFreeze({
      record,
      ibrRecord: input.ibrRecord,
      observations: deepFreeze([...input.observations]),
      registeredAt: this.clock(),
    });

    this.records.set(this.createKey(record.entityId, record.version.versionId), registration);
    return registration;
  }

  public getByEntityIdAndVersion(entityId: string, versionId: string): RegisteredEntityRuntime | undefined {
    return this.records.get(this.createKey(entityId, versionId));
  }

  public listAll(): readonly RegisteredEntityRuntime[] {
    return deepFreeze(
      [...this.records.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
    );
  }

  public deleteByEntityIdAndVersion(entityId: string, versionId: string): boolean {
    return this.records.delete(this.createKey(entityId, versionId));
  }

  public count(): number {
    return this.records.size;
  }

  private createKey(entityId: string, versionId: string): string {
    return `${entityId}:${versionId}`;
  }
}
