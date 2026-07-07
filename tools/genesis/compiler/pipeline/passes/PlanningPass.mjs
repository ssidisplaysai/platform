/**
 * PlanningPass - Create compilation plan
 *
 * @module tools/genesis/compiler/pipeline/passes/PlanningPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class PlanningPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Planning",
      description: "Create compilation plan based on blueprint",
      order: 30,
      ...options,
    });

    this.planner = options.planner;
  }

  validate(context) {
    if (!context.blueprint) {
      return {
        isValid: false,
        error: "Context missing blueprint (run BlueprintPass first)",
      };
    }
    if (!this.planner) {
      return {
        isValid: false,
        error: "PlanningPass missing planner instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Create compilation plan from blueprint
      const plan = this.planner.createPlan(
        context.entityName,
        context.blueprint
      );

      if (!plan) {
        throw new Error(
          `Failed to create compilation plan for: ${context.entityName}`
        );
      }

      context.plan = plan;
      context.addDiagnostic("info", `Compilation plan created`, {
        artifactCount: plan.artifacts?.length || 0,
        stages: plan.stages?.length || 0,
      });

      return context;
    } catch (error) {
      throw error;
    }
  }
}
