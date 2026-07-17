import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendDiagnostic, appendEvidence, withPassResult } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze } from "../types";

export class DefinitionValidationPass implements RuntimePolicyCompilerPass {
  readonly name = "DefinitionValidation" as const;

  execute(
    state: Parameters<RuntimePolicyCompilerPass["execute"]>[0],
    context: Parameters<RuntimePolicyCompilerPass["execute"]>[1],
  ): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    const inputDigest = createDigest(state.normalizedDefinition);
    let diagnostics = state.diagnostics;
    let evidence = state.evidence;

    const fail = (code: string, message: string, reason: string, details?: Readonly<Record<string, unknown>>) => {
      diagnostics = appendDiagnostic(diagnostics, "Error", code, message, details);
      evidence = appendEvidence(evidence, "DefinitionValidationFailed", {
        reason,
      });
      const next = deepFreeze({
        ...state,
        diagnostics,
        evidence,
        failed: true,
        failureReason: `${code}: ${reason}`,
      });
      return withPassResult(next, this.name, inputDigest, {
        success: false,
        failureReason: next.failureReason,
      });
    };

    if (!state.normalizedDefinition.name.trim()) {
      return fail("GRT-POL-VAL-001", "Policy definition name is required.", "RuntimePolicyDefinition.name is required.");
    }

    if (state.normalizedDefinition.rules.length === 0) {
      return fail("GRT-POL-VAL-002", "At least one policy rule is required.", "RuntimePolicyDefinition.rules must contain at least one rule.");
    }

    if (state.normalizedDefinition.schemaVersion !== context.config.schemaVersion) {
      return fail(
        "GRT-POL-VAL-003",
        "Unsupported policy schema version.",
        `Unsupported schema version ${state.normalizedDefinition.schemaVersion}. Expected ${context.config.schemaVersion}.`,
        deepFreeze({
          schemaVersion: state.normalizedDefinition.schemaVersion,
          expectedSchemaVersion: context.config.schemaVersion,
        }),
      );
    }

    const lifecycle = state.normalizedDefinition.lifecycleState;
    const supportedLifecycles = new Set(["Draft", "Active", "Deprecated", "Archived"]);
    if (!supportedLifecycles.has(lifecycle)) {
      return fail(
        "GRT-POL-VAL-004",
        "Unsupported policy lifecycle state.",
        `Unsupported lifecycle state ${lifecycle}.`,
        deepFreeze({ lifecycleState: lifecycle }),
      );
    }

    const conflictStrategy = state.normalizedDefinition.conflictStrategy ?? "deny-overrides";
    const supportedConflictStrategies = new Set(["deny-overrides", "permit-overrides", "first-applicable", "only-one-applicable"]);
    if (!supportedConflictStrategies.has(conflictStrategy)) {
      return fail(
        "GRT-POL-VAL-005",
        "Unsupported conflict strategy.",
        `Unsupported conflict strategy ${String(conflictStrategy)}.`,
        deepFreeze({ conflictStrategy }),
      );
    }

    const ruleNameTargetKeys = new Set<string>();
    const explicitRuleIds = new Set<string>();
    for (const rule of state.normalizedDefinition.rules) {
      const supportedEffects = new Set(["Permit", "Deny", "Conditional"]);
      if (!supportedEffects.has(rule.effect)) {
        return fail(
          "GRT-POL-VAL-006",
          "Unsupported rule effect.",
          `Unsupported rule effect ${String(rule.effect)} for rule ${rule.name}.`,
          deepFreeze({ ruleName: rule.name, effect: rule.effect }),
        );
      }

      if (!rule.name.trim()) {
        return fail(
          "GRT-POL-VAL-007",
          "Rule name is required.",
          "RuntimePolicyRuleDefinition.name is required.",
        );
      }

      if (!rule.target.targetType || !String(rule.target.targetType).trim()) {
        return fail(
          "GRT-POL-VAL-008",
          "Rule targetType is required.",
          `Rule ${rule.name} must define target.targetType.`,
          deepFreeze({ ruleName: rule.name }),
        );
      }

      const duplicateKey = `${rule.name}::${rule.target.targetType}::${rule.target.targetId ?? "*"}`;
      if (ruleNameTargetKeys.has(duplicateKey)) {
        return fail(
          "GRT-POL-VAL-009",
          "Duplicate policy rule detected.",
          `Duplicate rule signature detected for ${rule.name}.`,
          deepFreeze({ duplicateKey }),
        );
      }
      ruleNameTargetKeys.add(duplicateKey);

      if (rule.ruleId) {
        if (explicitRuleIds.has(rule.ruleId)) {
          return fail(
            "GRT-POL-VAL-010",
            "Duplicate explicit ruleId detected.",
            `Duplicate explicit ruleId ${rule.ruleId}.`,
            deepFreeze({ ruleId: rule.ruleId }),
          );
        }
        explicitRuleIds.add(rule.ruleId);
      }

      for (const obligation of rule.obligations ?? []) {
        if (!obligation.obligationType || !obligation.obligationType.trim()) {
          return fail(
            "GRT-POL-VAL-011",
            "Invalid obligation definition.",
            `Rule ${rule.name} contains an obligation without obligationType.`,
            deepFreeze({ ruleName: rule.name }),
          );
        }
      }
    }

    if (this.hasCallback(state.normalizedDefinition)) {
      return fail(
        "GRT-POL-VAL-012",
        "Executable callbacks are not permitted in RuntimePolicyDefinition.",
        "RuntimePolicyDefinition contains function-valued data.",
      );
    }

    const next = deepFreeze({
      ...state,
      diagnostics,
      evidence: appendEvidence(evidence, "DefinitionValidated", {
        ruleCount: state.normalizedDefinition.rules.length,
        schemaVersion: state.normalizedDefinition.schemaVersion,
      }),
    });

    return withPassResult(next, this.name, inputDigest);
  }

  private hasCallback(value: unknown): boolean {
    if (typeof value === "function") {
      return true;
    }
    if (!value || typeof value !== "object") {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((entry) => this.hasCallback(entry));
    }
    for (const entry of Object.values(value as Record<string, unknown>)) {
      if (this.hasCallback(entry)) {
        return true;
      }
    }
    return false;
  }
}
