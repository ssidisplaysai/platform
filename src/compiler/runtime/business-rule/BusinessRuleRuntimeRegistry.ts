import { deepFreeze } from "../foundation/immutability";
import type {
  BusinessRuleRuntimeObject,
  BusinessRuleRuntimeRegistryOptions,
  BusinessRuleValidationResult,
  RegisteredBusinessRuleRuntime,
} from "./contracts";

export class BusinessRuleRuntimeRegistry {
  private readonly factory: BusinessRuleRuntimeRegistryOptions["factory"];

  private readonly validators: BusinessRuleRuntimeRegistryOptions["validators"];

  private readonly clock: () => string;

  private readonly records = new Map<string, RegisteredBusinessRuleRuntime>();

  public constructor(options: BusinessRuleRuntimeRegistryOptions) {
    this.factory = options.factory;
    this.validators = deepFreeze([...(options.validators ?? [])]);
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public register(rule: BusinessRuleRuntimeObject): RegisteredBusinessRuleRuntime {
    const validation = this.factory.validateRule(rule, this.validators ?? []);
    this.assertNoValidationFailures(validation);

    const registration: RegisteredBusinessRuleRuntime = deepFreeze({
      rule,
      validation,
      registeredAt: this.clock(),
    });

    // Duplicate ruleIds intentionally overwrite prior immutable snapshots.
    this.records.set(rule.identity.ruleId, registration);
    return registration;
  }

  public getByRuleId(ruleId: string): RegisteredBusinessRuleRuntime | undefined {
    return this.records.get(ruleId);
  }

  public listAll(): readonly RegisteredBusinessRuleRuntime[] {
    return deepFreeze(
      [...this.records.values()].sort((left, right) => left.rule.identity.ruleId.localeCompare(right.rule.identity.ruleId)),
    );
  }

  public deleteByRuleId(ruleId: string): boolean {
    return this.records.delete(ruleId);
  }

  public count(): number {
    return this.records.size;
  }

  private assertNoValidationFailures(validation: readonly BusinessRuleValidationResult[]): void {
    const failure = validation.find((result) => result.status === "fail");
    if (failure) {
      throw new Error(`Business rule validation failed: ${failure.code} ${failure.message}`.trim());
    }
  }
}
