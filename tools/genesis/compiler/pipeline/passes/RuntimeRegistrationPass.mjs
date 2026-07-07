/**
 * RuntimeRegistrationPass - Register promoted artifacts in runtime
 *
 * @module tools/genesis/compiler/pipeline/passes/RuntimeRegistrationPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class RuntimeRegistrationPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "RuntimeRegistration",
      description: "Register promoted artifacts in runtime",
      order: 80,
      ...options,
    });

    this.runtime = options.runtime;
  }

  validate(context) {
    if (!context.entityName) {
      return {
        isValid: false,
        error: "Context missing entityName",
      };
    }
    if (!this.runtime) {
      return {
        isValid: false,
        error: "RuntimeRegistrationPass missing runtime instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Register entity in runtime
      const registrationResult = await this.runtime.registerEntity(
        context.entityName,
        {
          definition: context.definition,
          blueprint: context.blueprint,
          artifacts: context.artifacts,
        }
      );

      if (!registrationResult || !registrationResult.success) {
        throw new Error(
          `Runtime registration failed: ${registrationResult?.error || "Unknown error"}`
        );
      }

      context.addDiagnostic("info", `Entity registered in runtime`, {
        componentCount: registrationResult.registeredCount || 0,
      });

      context.metadata.runtimeRegistration = registrationResult;

      return context;
    } catch (error) {
      throw error;
    }
  }
}
