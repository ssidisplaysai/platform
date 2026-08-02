import { deepFreeze } from "../foundation/immutability";
import type { EvidenceRuntimeObject } from "../evidence/contracts";
import { EvidenceValidationRuntimeFactory } from "./EvidenceValidationRuntimeFactory";
import type {
  EvidenceValidationRuntimeRegistryOptions,
  RegisteredEvidenceValidationRuntime,
} from "./contracts";

export class EvidenceValidationRuntimeRegistry {
  private readonly factory: EvidenceValidationRuntimeFactory;

  private readonly rules: EvidenceValidationRuntimeRegistryOptions["rules"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredEvidenceValidationRuntime>();

  public constructor(options: EvidenceValidationRuntimeRegistryOptions) {
    this.factory = options.factory as EvidenceValidationRuntimeFactory;
    this.rules = deepFreeze([...(options.rules ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(evidence: EvidenceRuntimeObject): RegisteredEvidenceValidationRuntime {
    const record = this.factory.createValidationRecord(evidence, this.rules);
    const registration: RegisteredEvidenceValidationRuntime = deepFreeze({
      record,
      evidence,
      registeredAt: this.clock(),
    });

    this.records.set(this.createKey(evidence.identity.evidenceId, evidence.version.versionId), registration);
    return registration;
  }

  public getByEvidenceIdAndVersion(
    evidenceId: string,
    versionId: string,
  ): RegisteredEvidenceValidationRuntime | undefined {
    return this.records.get(this.createKey(evidenceId, versionId));
  }

  public listAll(): readonly RegisteredEvidenceValidationRuntime[] {
    return deepFreeze(
      [...this.records.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value),
    );
  }

  public deleteByEvidenceIdAndVersion(evidenceId: string, versionId: string): boolean {
    return this.records.delete(this.createKey(evidenceId, versionId));
  }

  public count(): number {
    return this.records.size;
  }

  private createKey(evidenceId: string, versionId: string): string {
    return `${evidenceId}:${versionId}`;
  }
}
