/**
 * WritingPass - Write generated artifacts to disk
 *
 * @module tools/genesis/compiler/pipeline/passes/WritingPass
 */

import { CompilerPass } from "../CompilerPass.mjs";

export class WritingPass extends CompilerPass {
  constructor(options = {}) {
    super({
      name: "Writing",
      description: "Write generated artifacts to disk",
      order: 50,
      ...options,
    });

    this.writer = options.writer;
  }

  validate(context) {
    if (!context.artifacts || context.artifacts.length === 0) {
      return {
        isValid: false,
        error: "Context has no artifacts (run RenderingPass first)",
      };
    }
    if (!this.writer) {
      return {
        isValid: false,
        error: "WritingPass missing writer instance",
      };
    }
    return { isValid: true };
  }

  async execute(context) {
    try {
      // Write artifacts to disk
      const writeResults = await this.writer.writeArtifacts(
        context.entityName,
        context.artifacts
      );

      if (!writeResults || !writeResults.success) {
        throw new Error(
          `Failed to write artifacts: ${writeResults?.error || "Unknown error"}`
        );
      }

      context.addDiagnostic("info", `Artifacts written to disk`, {
        count: writeResults.count,
        paths: writeResults.paths || [],
      });

      return context;
    } catch (error) {
      throw error;
    }
  }
}
