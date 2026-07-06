/**
 * plan command
 *
 * Creates a generation plan for an entity definition.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs plan Customer
 *
 * Output:
 *   - Plan summary
 *   - Ordered steps
 *   - Artifact count
 */

import { resolveDefinitionName } from "../compiler/registry/DefinitionResolver.mjs";
import { createGenerationContext } from "../compiler/planner/GenerationContext.mjs";
import { planEntity } from "../compiler/planner/GenerationPlanner.mjs";

export async function runPlanCommand(target) {
  if (!target) {
    console.error("Missing entity name.");
    console.error("Usage: node tools/genesis/genesis.mjs plan <EntityName>");
    console.error("Example: node tools/genesis/genesis.mjs plan Customer");
    process.exit(1);
  }

  try {
    // Resolve the definition name to canonical form
    const entityName = resolveDefinitionName(target);

    // Create a lightweight definition for planning
    const definition = {
      name: entityName,
      type: "entity",
    };

    // Create generation context
    const context = createGenerationContext({
      rootDir: process.cwd(),
      definition: definition,
    });

    // Create the generation plan
    const plan = planEntity(context);

    // Print plan results
    console.log("Genesis Planner v0.1\n");
    console.log("Planning Entity\n");
    console.log(plan.subject + "\n");

    // Print steps
    for (const step of plan.steps) {
      console.log(`✓ ${step.name}`);
    }

    console.log("\nPlan Complete\n");
    console.log(`${plan.steps.length} Artifacts`);

  } catch (error) {
    console.error("Plan command failed.");
    console.error(error.message);
    process.exit(1);
  }
}
