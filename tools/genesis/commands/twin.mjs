/**
 * twin command
 *
 * Build and manage the Enterprise Digital Twin.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs twin build [tenantId]
 *   node tools/genesis/genesis.mjs twin summary [tenantId]
 *   node tools/genesis/genesis.mjs twin health [tenantId]
 */

import { EnterpriseTwinBuilder } from "../compiler/EnterpriseTwinBuilder.mjs";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export async function runTwinCommand(args = []) {
  const [subcommand, ...subArgs] = args;

  if (!subcommand) {
    console.error("Missing twin subcommand.");
    console.error("Usage:");
    console.error("  node tools/genesis/genesis.mjs twin build [tenantId]");
    console.error("  node tools/genesis/genesis.mjs twin summary [tenantId]");
    console.error("  node tools/genesis/genesis.mjs twin health [tenantId]");
    process.exit(1);
  }

  if (subcommand === "build") {
    await buildTwin(subArgs);
  } else if (subcommand === "summary") {
    await displayTwinSummary(subArgs);
  } else if (subcommand === "health") {
    await displayTwinHealth(subArgs);
  } else {
    console.error(`Unknown twin subcommand: ${subcommand}`);
    process.exit(1);
  }
}

async function buildTwin(args) {
  const [tenantId = "default", ...options] = args;

  try {
    console.log("");
    const builder = new EnterpriseTwinBuilder(tenantId);
    const success = await builder.build();

    if (success) {
      const results = builder.getResults();
      console.log("✓ Twin built successfully");
      console.log(`  Tenant: ${results.tenantId}`);
      console.log(`  Nodes: ${results.nodes}`);
      console.log(`  Relationships: ${results.relationships}`);
      console.log(`  Health: ${results.healthScore}`);
    } else {
      console.error("✗ Twin build failed");
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Twin build failed: ${error.message}`);
    process.exit(1);
  }
}

async function displayTwinSummary(args) {
  const [tenantId = "default"] = args;

  try {
    const twinDir = join(projectRoot, "out/generated/twins", `tenant-${tenantId}`);

    if (!existsSync(twinDir)) {
      console.error(`✗ Twin not found for tenant: ${tenantId}`);
      console.error("  Run: node tools/genesis/genesis.mjs twin build " + tenantId);
      process.exit(1);
    }

    const summaryPath = join(twinDir, "twin-graph-summary.json");
    if (!existsSync(summaryPath)) {
      console.error("✗ Twin summary file not found");
      process.exit(1);
    }

    const summary = JSON.parse(readFileSync(summaryPath, "utf8"));

    console.log("\n≡ƒôè Enterprise Digital Twin Summary\n");
    console.log(`Tenant:            ${summary.tenantId}`);
    console.log(`Organization:      ${summary.organizationId}`);
    console.log(`Graph ID:          ${summary.graphId}`);
    console.log(`Status:            ${summary.status}`);
    console.log(`Health Score:      ${summary.stats.avgHealthScore}`);
    console.log("");
    console.log("Node Breakdown:");
    console.log(`  Organizations:   ${summary.nodeBreakdown.organizations}`);
    console.log(`  Applications:    ${summary.nodeBreakdown.applications}`);
    console.log(`  Modules:         ${summary.nodeBreakdown.modules}`);
    console.log(`  Objects:         ${summary.nodeBreakdown.objects}`);
    console.log(`  Workflows:       ${summary.nodeBreakdown.workflows}`);
    console.log(`  Automations:     ${summary.nodeBreakdown.automations}`);
    console.log(`  AI Agents:       ${summary.nodeBreakdown.agents}`);
    console.log(`  Components:      ${summary.nodeBreakdown.components}`);
    console.log("");
    console.log("Graph Statistics:");
    console.log(`  Total Nodes:           ${summary.stats.nodeCount}`);
    console.log(`  Total Relationships:   ${summary.stats.relationshipCount}`);
    console.log(`  Total Access Count:    ${summary.stats.totalMetrics.totalAccess}`);
    console.log(`  Total Updates:         ${summary.stats.totalMetrics.totalUpdates}`);
    console.log(`  Total Errors:          ${summary.stats.totalMetrics.totalErrors}`);
    console.log("");
    console.log(`Updated: ${summary.lastUpdatedAt}`);
    console.log("");
  } catch (error) {
    console.error(`✗ Failed to display summary: ${error.message}`);
    process.exit(1);
  }
}

async function displayTwinHealth(args) {
  const [tenantId = "default"] = args;

  try {
    const twinDir = join(projectRoot, "out/generated/twins", `tenant-${tenantId}`);

    if (!existsSync(twinDir)) {
      console.error(`✗ Twin not found for tenant: ${tenantId}`);
      console.error("  Run: node tools/genesis/genesis.mjs twin build " + tenantId);
      process.exit(1);
    }

    const healthPath = join(twinDir, "twin-health-report.json");
    if (!existsSync(healthPath)) {
      console.error("✗ Twin health report not found");
      process.exit(1);
    }

    const report = JSON.parse(readFileSync(healthPath, "utf8"));

    console.log("\n≡ƒôè Enterprise Digital Twin Health Report\n");
    console.log(`Overall Health:    ${report.overallHealth}`);
    console.log(`Status:            ${report.status}`);
    console.log("");
    console.log("Node Health:");
    console.log(`  Healthy:         ${report.nodeHealth.healthy}`);
    console.log(`  Degraded:        ${report.nodeHealth.degraded}`);
    console.log(`  Unhealthy:       ${report.nodeHealth.unhealthy}`);
    console.log(`  Total:           ${report.nodeHealth.total}`);
    console.log("");
    console.log(`Error Count:       ${report.errors}`);
    console.log(`Error Rate:        ${report.errorRate}%`);
    console.log("");
  } catch (error) {
    console.error(`✗ Failed to display health: ${error.message}`);
    process.exit(1);
  }
}
