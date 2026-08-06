import { compareDeterministicStrings } from "../utilities";

export type InvariantRule<TValue> = {
  ruleId: string;
  validate(value: TValue): string[];
};

export class InvariantEngine<TValue> {
  private readonly rules: InvariantRule<TValue>[] = [];

  register(rule: InvariantRule<TValue>): void {
    this.rules.push(rule);
  }

  assert(value: TValue): void {
    const failures = this.evaluate(value);
    if (failures.length > 0) {
      throw new Error(`invariant violation: ${failures.join("; ")}`);
    }
  }

  evaluate(value: TValue): string[] {
    const failures: string[] = [];
    for (const rule of [...this.rules].sort((left, right) => compareDeterministicStrings(left.ruleId, right.ruleId))) {
      failures.push(...rule.validate(value));
    }
    return failures;
  }
}
