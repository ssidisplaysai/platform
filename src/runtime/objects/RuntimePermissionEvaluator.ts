import type { RuntimePermissionEvaluation, RuntimePermissionRule } from "./types";

export class RuntimePermissionEvaluator {
  private readonly rules = new Map<string, RuntimePermissionRule>();

  registerRule(rule: RuntimePermissionRule): void {
    if (this.rules.has(rule.ruleId)) {
      throw new Error(`GRT-OBJ-PERM-001: Duplicate permission rule: ${rule.ruleId}`);
    }

    this.rules.set(rule.ruleId, Object.freeze({
      ...rule,
      constraints: rule.constraints
        ? Object.freeze(Object.fromEntries(Object.entries(rule.constraints).sort((a, b) => a[0].localeCompare(b[0]))))
        : undefined,
    }));
  }

  evaluate(request: {
    principal: string;
    action: string;
    resource: string;
    constraints?: Readonly<Record<string, string | number | boolean>>;
  }): RuntimePermissionEvaluation {
    const sorted = [...this.rules.values()].sort((a, b) => {
      const left = `${a.principal}|${a.action}|${a.resource}|${a.effect}|${a.ruleId}`;
      const right = `${b.principal}|${b.action}|${b.resource}|${b.effect}|${b.ruleId}`;
      return left.localeCompare(right);
    });

    const matched = sorted
      .filter((rule) => this.matches(rule, request))
      .map((rule) => rule.ruleId);

    const denyRuleIds = sorted
      .filter((rule) => matched.includes(rule.ruleId) && rule.effect === "deny")
      .map((rule) => rule.ruleId);

    const allowRuleIds = sorted
      .filter((rule) => matched.includes(rule.ruleId) && rule.effect === "allow")
      .map((rule) => rule.ruleId);

    const granted = denyRuleIds.length === 0 && allowRuleIds.length > 0;

    return Object.freeze({
      granted,
      matchedRuleIds: Object.freeze(matched),
      denyRuleIds: Object.freeze(denyRuleIds),
      allowRuleIds: Object.freeze(allowRuleIds),
    });
  }

  listRules(): readonly RuntimePermissionRule[] {
    return Object.freeze([...this.rules.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId)));
  }

  private matches(
    rule: RuntimePermissionRule,
    request: { principal: string; action: string; resource: string; constraints?: Readonly<Record<string, string | number | boolean>> },
  ): boolean {
    if (rule.principal !== request.principal) {
      return false;
    }
    if (rule.action !== request.action) {
      return false;
    }
    if (!(rule.resource === "*" || rule.resource === request.resource)) {
      return false;
    }

    const constraints = rule.constraints ?? {};
    return Object.entries(constraints).every(([key, value]) => request.constraints?.[key] === value);
  }
}
