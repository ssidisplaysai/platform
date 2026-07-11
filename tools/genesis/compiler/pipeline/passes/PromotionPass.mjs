/**
 * PromotionPass - Promote validated artifacts to runtime
 *
 * @module tools/genesis/compiler/pipeline/passes/PromotionPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class PromotionPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Promotion",
      description: "Promote validated artifacts to runtime",
      order: 70,
      ...options,
    });

    this.engine = options.promotionEngine;
  }

  validate(context) {
    if (!context.entityName) {
      return {
        isValid: false,
        error: "Context missing entityName",
      };
    }
    if (!this.engine) {
      return {
        isValid: false,
        error: "PromotionPass missing promotionEngine instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Promote artifacts to runtime
      const promotionResult = await this.engine.promote(context.entityName);

      if (!promotionResult.success) {
        throw new Error(
          `Promotion failed: ${promotionResult.error || "Unknown error"}`
        );
      }

      context.addDiagnostic("info", `Artifacts promoted to runtime`, {
        promotedCount: promotionResult.promotedArtifacts?.length || 0,
        registeredComponents:
          promotionResult.registeredComponents?.length || 0,
      });

      context.metadata.promotionResult = promotionResult;

      return context;
    } catch (error) {
      throw error;
    }
  }
}
