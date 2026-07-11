/**
 * compile command
 *
 * Compiles and generates entity code, module manifests, applications, or solutions.
 * Routes to CodeGenerationEngine for entities, ModuleCompiler for modules,
 * ApplicationCompiler for applications, or SolutionCompiler for solutions.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs compile Customer
 *   node tools/genesis/genesis.mjs compile Customer --write
 *   node tools/genesis/genesis.mjs compile modules
 *   node tools/genesis/genesis.mjs compile application CRM
 *   node tools/genesis/genesis.mjs compile solution SSI
 *
 * Modes:
 *   - entity: Generates entity artifacts to out/ directory (CodeGenerationEngine)
 *   - modules: Generates module manifests to out/generated/modules/ (ModuleCompiler)
 *   - application: Compiles modules into deployable application (ApplicationCompiler)
 *   - solution: Compiles applications into enterprise solution (SolutionCompiler)
 *
 * Output:
 *   - Entity: Generated entity artifacts with validators from blueprint
 *   - Modules: Generated module manifests and registry summary
 *   - Application: Application manifest, blueprint, navigation, dashboards, API surface
 *   - Solution: Solution manifest, navigation, API/AI catalogs, branding
 */

import { generate } from "../compiler/CodeGenerationEngine.mjs";
import { runCompileModulesCommand } from "./compileModules.mjs";
import { ApplicationCompiler } from "../compiler/ApplicationCompiler.mjs";
import { SolutionCompiler } from "../compiler/SolutionCompiler.mjs";

export async function runCompileCommand(target, options = []) {
  if (!target) {
    console.error("Missing target.");
    console.error("Usage: node tools/genesis/genesis.mjs compile <EntityName|modules|application|solution>");
    console.error("Examples:");
    console.error("  node tools/genesis/genesis.mjs compile Customer");
    console.error("  node tools/genesis/genesis.mjs compile modules");
    console.error("  node tools/genesis/genesis.mjs compile application CRM");
    console.error("  node tools/genesis/genesis.mjs compile solution SSI");
    process.exit(1);
  }

  try {
    if (target === 'modules') {
      // Compile all modules
      await runCompileModulesCommand(options);
    } else if (target === 'application') {
      // Compile application from modules
      const [applicationName] = options;
      if (!applicationName) {
        console.error("Missing application name.");
        console.error("Usage: node tools/genesis/genesis.mjs compile application <AppName>");
        console.error("Example: node tools/genesis/genesis.mjs compile application CRM");
        process.exit(1);
      }
      
      const compiler = new ApplicationCompiler(applicationName);
      const success = await compiler.compile();
      
      if (!success) {
        console.error("\n✗ Application compilation failed");
        if (compiler.errors.length > 0) {
          console.error("\nErrors:");
          compiler.errors.forEach(err => console.error(`  • ${err}`));
        }
        process.exit(1);
      }
      
      if (compiler.warnings.length > 0) {
        console.warn("\nWarnings:");
        compiler.warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
      }
    } else if (target === 'solution') {
      // Compile solution from applications
      const [solutionName] = options;
      if (!solutionName) {
        console.error("Missing solution name.");
        console.error("Usage: node tools/genesis/genesis.mjs compile solution <SolutionName>");
        console.error("Example: node tools/genesis/genesis.mjs compile solution SSI");
        process.exit(1);
      }
      
      const compiler = new SolutionCompiler(solutionName);
      const success = await compiler.compile();
      
      if (!success) {
        console.error("\n✗ Solution compilation failed");
        if (compiler.errors.length > 0) {
          console.error("\nErrors:");
          compiler.errors.forEach(err => console.error(`  • ${err}`));
        }
        process.exit(1);
      }
      
      if (compiler.warnings.length > 0) {
        console.warn("\nWarnings:");
        compiler.warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
      }
    } else {
      // Compile single entity
      await generate({ entity: target });
    }
  } catch (error) {
    console.error(`Compilation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
