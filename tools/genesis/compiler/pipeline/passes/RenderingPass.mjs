/**
 * RenderingPass - Render artifact templates
 *
 * @module tools/genesis/compiler/pipeline/passes/RenderingPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class RenderingPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Rendering",
      description: "Render artifact templates using template engine",
      order: 40,
      ...options,
    });

    this.compiler = options.compiler;
  }

  validate(context) {
    if (!context.plan) {
      return {
        isValid: false,
        error: "Context missing plan (run PlanningPass first)",
      };
    }
    if (!this.compiler) {
      return {
        isValid: false,
        error: "RenderingPass missing compiler instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Render templates for each artifact in plan
      const { artifacts, errors } = await this.compiler.renderArtifacts(
        context.entityName,
        context.plan,
        context.blueprint
      );

      if (errors && errors.length > 0) {
        errors.forEach((err) => {
          context.addDiagnostic("error", `Rendering error: ${err}`);
        });
      }

      if (!artifacts || artifacts.length === 0) {
        throw new Error("No artifacts were rendered");
      }

      // Add rendered artifacts to context
      artifacts.forEach((artifact) => {
        context.addArtifact(artifact);
      });

      context.addDiagnostic("info", `Artifacts rendered: ${artifacts.length}`);

      return context;
    } catch (error) {
      throw error;
    }
  }
}
