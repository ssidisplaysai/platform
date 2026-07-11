/**
 * DefinitionRegistryPass - Load entity definition from registry
 *
 * @module tools/genesis/compiler/pipeline/passes/DefinitionRegistryPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class DefinitionRegistryPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "DefinitionRegistry",
      description: "Load entity definition from the registry",
      order: 10,
      ...options,
    });

    this.registry = options.registry;
  }

  validate(context) {
    if (!context.entityName) {
      return {
        isValid: false,
        error: "Context missing entityName",
      };
    }
    if (!this.registry) {
      return {
        isValid: false,
        error: "DefinitionRegistryPass missing registry instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Load definition from registry
      const definition = this.registry.getDefinition(context.entityName);

      if (!definition) {
        throw new Error(
          `Definition not found for entity: ${context.entityName}`
        );
      }

      context.definition = definition;
      context.addDiagnostic(
        "info",
        `Definition loaded: ${context.entityName}`,
        {
          fields: definition.artifacts?.length || 0,
        }
      );

      return context;
    } catch (error) {
      throw error;
    }
  }
}
