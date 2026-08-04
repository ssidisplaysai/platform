import { deepFreeze } from "../foundation/immutability";
import type {
  BusinessGenomeAssemblyOutput,
  BusinessGenomeAssemblyRuntimeRegistryOptions,
  BusinessGenomeAssemblyValidationResult,
  RegisteredBusinessGenomeAssemblyRuntime,
} from "./contracts";

export class BusinessGenomeAssemblyRuntimeRegistry {
  private readonly factory: BusinessGenomeAssemblyRuntimeRegistryOptions["factory"];

  private readonly validators: BusinessGenomeAssemblyRuntimeRegistryOptions["validators"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredBusinessGenomeAssemblyRuntime>();

  public constructor(options: BusinessGenomeAssemblyRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.validators = deepFreeze([...(options.validators ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(output: BusinessGenomeAssemblyOutput): RegisteredBusinessGenomeAssemblyRuntime {
    const validation = this.factory.validateGenome(output, this.validators ?? []);
    this.assertNoValidationFailures(validation);

    const registration: RegisteredBusinessGenomeAssemblyRuntime = deepFreeze({
      output,
      validation,
      registeredAt: this.clock(),
    });

    // Duplicate genomeIds intentionally overwrite prior immutable snapshots.
    this.records.set(output.identity.genomeId, registration);
    return registration;
  }

  public getByGenomeId(genomeId: string): RegisteredBusinessGenomeAssemblyRuntime | undefined {
    return this.records.get(genomeId);
  }

  public listAll(): readonly RegisteredBusinessGenomeAssemblyRuntime[] {
    return deepFreeze(
      [...this.records.values()].sort((left, right) => left.output.identity.genomeId.localeCompare(right.output.identity.genomeId)),
    );
  }

  public deleteByGenomeId(genomeId: string): boolean {
    return this.records.delete(genomeId);
  }

  public count(): number {
    return this.records.size;
  }

  private assertNoValidationFailures(validation: readonly BusinessGenomeAssemblyValidationResult[]): void {
    const failure = validation.find((result) => result.status === "fail");
    if (failure) {
      throw new Error(`Business genome assembly validation failed: ${failure.code} ${failure.message}`.trim());
    }
  }
}
