import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export async function runRuntimeCommand() {
  try {
    const manifestPath = join(
      projectRoot,
      "out/generated/runtime-boot-manifest.json"
    );

    let manifest;
    try {
      const content = readFileSync(manifestPath, "utf8");
      manifest = JSON.parse(content);
    } catch (error) {
      console.error("❌ Runtime manifest not found.");
      console.error(
        "   Run 'node tools/genesis/genesis.mjs boot' to initialize runtime."
      );
      process.exit(1);
    }

    const finalState = manifest.finalState || {};
    const stageResults = manifest.stageResults || [];
    const bootMetadata = manifest.metadata || {};

    // Print runtime diagnostics
    printRuntimeDiagnostics(finalState, stageResults, bootMetadata, manifest);
  } catch (error) {
    console.error("Runtime diagnostics failed:", error.message);
    process.exit(1);
  }
}

function printRuntimeDiagnostics(finalState, stageResults, bootMetadata, manifest) {
  console.log("\n≡ƒÜÇ Genesis Runtime Diagnostics\n");

  // Runtime Status Section
  printSection("RUNTIME STATUS", () => {
    const statusIcon = finalState.ready ? "✅" : "❌";
    console.log(`  ${statusIcon} Status: ${finalState.ready ? "READY" : "NOT READY"}`);
    console.log(`     Phase: ${finalState.phase || "unknown"}`);
    console.log(
      `     Boot Time: ${formatDate(manifest.bootStartTime || bootMetadata.generatedAt)}`
    );
    console.log(
      `     Boot Duration: ${finalState.bootDuration || manifest.totalDuration || 0}ms`
    );
  });

  // Discovered Items Section
  printSection("DISCOVERED ITEMS", () => {
    console.log(`  ├─ Modules: ${finalState.discoveredModules || 0}`);
    console.log(`  ├─ Objects: ${finalState.discoveredObjects || 0}`);
    console.log(`  ├─ APIs: ${finalState.discoveredAPIs || 0}`);
    console.log(`  ├─ Workflows: ${finalState.discoveredWorkflows || 0}`);
    console.log(`  ├─ Automations: ${finalState.discoveredAutomations || 0}`);
    console.log(`  ├─ AI Agents: ${finalState.discoveredAgents || 0}`);
    console.log(`  ├─ Repositories: ${finalState.discoveredRepositories || 0}`);
    console.log(`  └─ Services: ${finalState.discoveredServices || 0}`);
    console.log(
      `\n     Total Discovered: ${finalState.totalDiscovered || 0} items`
    );
  });

  // Registered Components Section
  printSection("REGISTERED COMPONENTS", () => {
    console.log(`  ├─ Modules: ${finalState.registeredModules || 0}`);
    console.log(`  ├─ Objects: ${finalState.registeredObjects || 0}`);
    console.log(`  ├─ APIs: ${finalState.registeredAPIs || 0}`);
    console.log(`  ├─ Workflows: ${finalState.registeredWorkflows || 0}`);
    console.log(`  ├─ Automations: ${finalState.registeredAutomations || 0}`);
    console.log(`  ├─ AI Agents: ${finalState.registeredAgents || 0}`);
    console.log(`  ├─ Repositories: ${finalState.registeredRepositories || 0}`);
    console.log(`  └─ Services: ${finalState.registeredServices || 0}`);
    console.log(
      `\n     Total Registered: ${finalState.totalRegistered || 0} items`
    );
  });

  // Dependency Health Section
  printSection("DEPENDENCY HEALTH", () => {
    const resolved = finalState.dependenciesResolved || 0;
    const failed = finalState.dependenciesFailed || 0;
    const total = resolved + failed;

    if (total === 0) {
      console.log(`  ℹ  No dependencies to resolve`);
    } else {
      console.log(`  ├─ Resolved: ${resolved}/${total}`);
      console.log(`  └─ Failed: ${failed}/${total}`);

      if (failed > 0) {
        console.log(
          `\n     ⚠  ${failed} unresolved dependencies detected`
        );
      }
    }
  });

  // Manifest Validation Section
  const validationStage = stageResults.find(
    (s) => s.stageId === "manifest-validation"
  );
  if (validationStage) {
    printSection("MANIFEST VALIDATION", () => {
      const validated = validationStage.details?.validatedCount || 0;
      const failed = validationStage.details?.failedCount || 0;
      const total = validated + failed;

      console.log(`  ├─ Validated: ${validated}/${total}`);
      console.log(`  ├─ Failed: ${failed}/${total}`);
      console.log(`  └─ Status: ${validationStage.status}`);

      if (validationStage.errors && validationStage.errors.length > 0) {
        console.log(`\n     Errors:`);
        validationStage.errors.forEach((err) => {
          console.log(`       • ${err}`);
        });
      }

      if (validationStage.warnings && validationStage.warnings.length > 0) {
        console.log(`\n     Warnings:`);
        validationStage.warnings.forEach((warn) => {
          console.log(`       • ${warn}`);
        });
      }
    });
  }

  // Boot Stages Summary Section
  if (stageResults.length > 0) {
    printSection("BOOT STAGES SUMMARY", () => {
      stageResults.forEach((stage, idx) => {
        const icon = stage.status === "completed" ? "✅" : "⚠ ";
        const isLast = idx === stageResults.length - 1;
        const prefix = isLast ? "└─ " : "├─ ";
        console.log(
          `  ${prefix}${icon} ${stage.stageName}: ${stage.duration}ms (${stage.itemsProcessed} items)`
        );
      });
    });
  }

  // Errors and Warnings Section
  if (
    (finalState.totalErrors || 0) > 0 ||
    (finalState.totalWarnings || 0) > 0
  ) {
    printSection("ALERTS", () => {
      if ((finalState.totalErrors || 0) > 0) {
        console.log(`  ❌ Errors: ${finalState.totalErrors}`);
      }
      if ((finalState.totalWarnings || 0) > 0) {
        console.log(`  ⚠  Warnings: ${finalState.totalWarnings}`);
      }
    });
  } else {
    printSection("ALERTS", () => {
      console.log(`  ✅ No errors or warnings`);
    });
  }

  // Footer
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`Manifest: out/generated/runtime-boot-manifest.json`);
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

function printSection(title, content) {
  console.log(`\n  ╔═ ${title}`);
  console.log(`  ║`);
  content();
  console.log(`  ║\n`);
}

function formatDate(dateStr) {
  if (!dateStr) return "unknown";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}
