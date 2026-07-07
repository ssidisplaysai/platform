/**
 * BlueprintPass - Load and build entity blueprint from GEDL
 *
 * @module tools/genesis/compiler/pipeline/passes/BlueprintPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class BlueprintPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Blueprint",
      description: "Load and build entity blueprint from GEDL definition",
      order: 20,
      ...options,
    });

    this.blueprintBuilder = options.blueprintBuilder;
  }

  validate(context) {
    if (!context.entityName) {
      return {
        isValid: false,
        error: "Context missing entityName",
      };
    }
    if (!this.blueprintBuilder) {
      return {
        isValid: false,
        error: "BlueprintPass missing blueprintBuilder instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Build blueprint for entity
      const blueprint = await this.blueprintBuilder.buildBlueprint(
        context.entityName,
        "./definitions/entity"
      );

      if (!blueprint) {
        throw new Error(
          `Failed to build blueprint for entity: ${context.entityName}`
        );
      }

      context.blueprint = blueprint;
      context.addDiagnostic("info", `Blueprint loaded: ${context.entityName}`, {
        fields: blueprint.getFieldCount(),
        relationships: blueprint.getRelationshipCount(),
        capabilities: blueprint.getEnabledCapabilities(),
      });

      return context;
    } catch (error) {
      throw error;
    }
  }
}
