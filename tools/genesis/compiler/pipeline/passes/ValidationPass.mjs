/**
 * ValidationPass - Validate generated artifacts
 *
 * @module tools/genesis/compiler/pipeline/passes/ValidationPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class ValidationPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Validation",
      description: "Validate generated artifacts",
      order: 60,
      ...options,
    });

    this.validator = options.validator;
  }

  validate(context) {
    if (!context.artifacts || context.artifacts.length === 0) {
      return {
        isValid: false,
        error: "Context has no artifacts to validate",
      };
    }
    if (!this.validator) {
      return {
        isValid: false,
        error: "ValidationPass missing validator instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Validate all artifacts
      const validation = await this.validator.validateGeneratedSlice(
        context.entityName,
        {
          artifacts: context.artifacts,
          blueprint: context.blueprint,
        }
      );

      if (!validation.isValid) {
        const missingCount = validation.missingArtifacts?.length || 0;
        context.addDiagnostic(
          "error",
          `Validation failed: ${missingCount} artifacts missing`,
          {
            missing: validation.missingArtifacts,
          }
        );

        throw new Error(
          `Artifact validation failed: ${missingCount} missing artifacts`
        );
      }

      context.addDiagnostic("info", `Artifacts validated successfully`, {
        count: context.artifacts.length,
      });

      return context;
    } catch (error) {
      throw error;
    }
  }
}
