/**
 * compile command
 *
 * Compiles a generation plan for an entity definition.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs compile Customer
 *   node tools/genesis/genesis.mjs compile Customer --write
 *
 * Modes:
 *   - dry-run (default): Plans artifacts without writing
 *   - write (--write): Writes placeholder artifacts to file system
 *
 * Output:
 *   - Plan summary
 *   - Compilation mode
 *   - Artifacts planned or written
 *   - Result summary
 */

import { resolveDefinitionName } from "../compiler/registry/DefinitionResolver.mjs";
import { createGenerationContext } from "../compiler/planner/GenerationContext.mjs";
import { planEntity } from "../compiler/planner/GenerationPlanner.mjs";
import { createCompilationContext } from "../compiler/compiler/CompilationContext.mjs";
import { compilePlan } from "../compiler/compiler/GenerationCompiler.mjs";
import { writeArtifacts } from "../compiler/writers/ArtifactWriter.mjs";

export async function runCompileCommand(target, options = []) {
  if (!target) {
    console.error("Missing entity name.");
    console.error("Usage: node tools/genesis/genesis.mjs compile <EntityName> [--write]");
    console.error("Example: node tools/genesis/genesis.mjs compile Customer");
    console.error("Example: node tools/genesis/genesis.mjs compile Customer --write");
    process.exit(1);
  }

  try {
    // Parse options
    const writeMode = options.includes("--write");
    const compilationMode = writeMode ? "write" : "dry-run";

    // Resolve the definition name to canonical form
    const entityName = resolveDefinitionName(target);

    // Create a lightweight definition for planning
    const definition = {
      name: entityName,
      type: "entity",
    };

    // Create generation context (planning phase)
    const generationContext = createGenerationContext({
      rootDir: process.cwd(),
      definition: definition,
    });

    // Create the generation plan (Phase 2)
    const plan = planEntity(generationContext);

    // Create compilation context (execution phase)
    const compilationContext = createCompilationContext({
      rootDir: process.cwd(),
      plan: plan,
      mode: compilationMode,
    });

    // Compile the plan (Phase 3/4)
    const compilationResult = compilePlan(compilationContext);

    // If write mode, write artifacts
    let writeResult = null;
    if (writeMode) {
      writeResult = writeArtifacts({
        rootDir: process.cwd(),
        artifacts: compilationResult.artifacts,
        mode: "write",
        force: false,
      });
    }

    // Print compilation results
    console.log("Genesis Compiler v0.1\n");
    console.log("Compiling Entity\n");
    console.log(plan.subject + "\n");

    console.log("Mode");
    console.log(compilationMode + "\n");

    // Print artifacts
    for (const artifact of compilationResult.artifacts) {
      const status = writeResult
        ? (writeResult.artifacts.find(a => a.id === artifact.id)?.status || artifact.status)
        : artifact.status;
      console.log(`✓ ${artifact.name} ${status}`);
    }

    console.log("\nCompilation Complete\n");

    if (writeResult) {
      console.log(`${writeResult.written} Artifacts Written`);
      if (writeResult.skipped > 0) {
        console.log(`${writeResult.skipped} Artifacts Skipped`);
      }
    } else {
      console.log(`${compilationResult.artifacts.length} Artifacts Planned\n`);
      console.log("No files written.");
    }

  } catch (error) {
    console.error("Compile command failed.");
    console.error(error.message);
    process.exit(1);
  }
}
