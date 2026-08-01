import { deepFreeze } from "../foundation/immutability";
import type {
  EvidenceHealthStatus,
  EvidenceRuntimeObject,
  EvidenceValidationResult,
  EvidenceValidator,
} from "./contracts";
import { EvidenceRuntimeFactory } from "./EvidenceRuntimeFactory";

export interface RegisteredEvidenceRuntime {
  readonly evidence: EvidenceRuntimeObject;
  readonly validation: readonly EvidenceValidationResult[];
  readonly health: EvidenceHealthStatus;
  readonly registeredAt: string;
}

export interface EvidenceRuntimeRegistryOptions {
  readonly factory: EvidenceRuntimeFactory;
  readonly validators?: readonly EvidenceValidator[];
  readonly clock?: () => string;
}

export class EvidenceRuntimeRegistry {
  private readonly factory: EvidenceRuntimeFactory;

  private readonly validators: readonly EvidenceValidator[];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredEvidenceRuntime>();

  public constructor(options: EvidenceRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.validators = deepFreeze([...(options.validators ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(evidence: EvidenceRuntimeObject): RegisteredEvidenceRuntime {
    const validation = this.factory.validateEvidenceObject(evidence, this.validators);
    const health = this.factory.deriveHealthStatus(evidence, validation);

    const record: RegisteredEvidenceRuntime = deepFreeze({
      evidence,
      validation,
      health,
      registeredAt: this.clock(),
    });

    // Duplicate registrations are intentionally resolved by evidenceId overwrite to preserve latest immutable runtime snapshot.
    this.records.set(evidence.identity.evidenceId, record);
    return record;
  }

  public getByEvidenceId(evidenceId: string): RegisteredEvidenceRuntime | undefined {
    return this.records.get(evidenceId);
  }

  public listAll(): readonly RegisteredEvidenceRuntime[] {
    return deepFreeze(
      [...this.records.values()].sort((left, right) => left.evidence.identity.evidenceId.localeCompare(right.evidence.identity.evidenceId)),
    );
  }

  public deleteByEvidenceId(evidenceId: string): boolean {
    return this.records.delete(evidenceId);
  }

  public count(): number {
    return this.records.size;
  }
}