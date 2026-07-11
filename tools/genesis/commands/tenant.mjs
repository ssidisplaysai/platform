/**
 * tenant command
 *
 * Manage Genesis identity and tenants.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs tenant create <name> [options]
 *   node tools/genesis/genesis.mjs tenant list
 *   node tools/genesis/genesis.mjs tenant validate <tenantId>
 */

import { IdentityCompiler } from "../compiler/IdentityCompiler.mjs";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export async function runTenantCommand(args = []) {
  const [subcommand, ...subArgs] = args;

  if (!subcommand) {
    console.error("Missing tenant subcommand.");
    console.error("Usage:");
    console.error("  node tools/genesis/genesis.mjs tenant create <name> [options]");
    console.error("  node tools/genesis/genesis.mjs tenant list");
    console.error("  node tools/genesis/genesis.mjs tenant validate <tenantId>");
    process.exit(1);
  }

  if (subcommand === "create") {
    await createTenant(subArgs);
  } else if (subcommand === "list") {
    await listTenants(subArgs);
  } else if (subcommand === "validate") {
    await validateTenant(subArgs);
  } else {
    console.error(`Unknown tenant subcommand: ${subcommand}`);
    process.exit(1);
  }
}

async function createTenant(args) {
  const [tenantName, ...options] = args;

  if (!tenantName) {
    console.error("Missing tenant name.");
    console.error("Usage: node tools/genesis/genesis.mjs tenant create <name> [options]");
    process.exit(1);
  }

  try {
    // Parse options
    const opts = {
      displayName: tenantName,
      ownerEmail: "admin@example.com",
      ownerFirstName: "Admin",
      ownerLastName: "User",
      plan: "professional"
    };

    for (let i = 0; i < options.length; i += 2) {
      const key = options[i].replace(/^--/, "");
      const value = options[i + 1];
      if (key === "display-name") opts.displayName = value;
      if (key === "owner-email") opts.ownerEmail = value;
      if (key === "plan") opts.plan = value;
    }

    console.log(`\n≡ƒôè Creating tenant '${tenantName}'`);
    console.log("");

    const compiler = new IdentityCompiler(tenantName, opts);
    const success = await compiler.compile();

    if (success) {
      const results = compiler.getResults();
      console.log("✓ Tenant created successfully");
      console.log(`  Tenant ID: ${results.tenantId}`);
      console.log(`  Organizations: ${results.organizations}`);
      console.log(`  Roles: ${results.roles}`);
      console.log(`  Users: ${results.users}`);
    } else {
      console.error("✗ Tenant creation failed");
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Tenant creation failed: ${error.message}`);
    process.exit(1);
  }
}

async function listTenants(args) {
  try {
    const registryPath = join(projectRoot, "out/generated/identities/registry.json");

    if (!existsSync(registryPath)) {
      console.log("No tenants found.");
      return;
    }

    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const tenants = registry.tenants || [];

    if (tenants.length === 0) {
      console.log("No tenants found.");
      return;
    }

    console.log("\nGenesis Tenants\n");
    console.log(
      "Tenant ID".padEnd(30) +
      "Name".padEnd(25) +
      "Plan".padEnd(15) +
      "Status".padEnd(12) +
      "Orgs"
    );
    console.log("-".repeat(95));

    for (const tenant of tenants) {
      console.log(
        tenant.id.padEnd(30) +
        tenant.displayName.padEnd(25) +
        tenant.plan.padEnd(15) +
        tenant.status.padEnd(12) +
        tenant.organizationsCount.toString()
      );
    }

    console.log("");
    console.log(`Total: ${tenants.length} tenants`);
    console.log("");
  } catch (error) {
    console.error(`✗ Failed to list tenants: ${error.message}`);
    process.exit(1);
  }
}

async function validateTenant(args) {
  const [tenantId] = args;

  if (!tenantId) {
    console.error("Missing tenant ID.");
    console.error("Usage: node tools/genesis/genesis.mjs tenant validate <tenantId>");
    process.exit(1);
  }

  try {
    const registryPath = join(projectRoot, "out/generated/identities/registry.json");

    if (!existsSync(registryPath)) {
      console.error("✗ No tenants found.");
      process.exit(1);
    }

    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const tenant = registry.tenants?.find(t => t.id === tenantId);

    if (!tenant) {
      console.error(`✗ Tenant not found: ${tenantId}`);
      process.exit(1);
    }

    console.log(`\n≡ƒÜÇ Validating tenant '${tenant.displayName}'`);
    console.log("");

    // Load full blueprint (from identity or tenant file)
    let blueprintPath = join(
      projectRoot,
      "out/generated/identities",
      tenantId,
      tenant.blueprintFile || `${tenantId}.identity-full.json`
    );

    if (!existsSync(blueprintPath)) {
      // Try alternate path
      blueprintPath = join(
        projectRoot,
        "out/generated/identities",
        tenantId,
        `${tenantId}.tenant-full.json`
      );
    }

    if (!existsSync(blueprintPath)) {
      console.error("✗ Blueprint file not found");
      process.exit(1);
    }

    const blueprint = JSON.parse(readFileSync(blueprintPath, "utf8"));

    // Handle both Identity and Tenant blueprints
    const tenantBlueprint = blueprint.tenants?.[0] || blueprint;

    console.log("Validation Results:");
    console.log("");
    console.log(`  ✓ Tenant ID: ${tenant.id}`);
    console.log(`  ✓ Tenant Name: ${tenant.displayName}`);
    console.log(`  ✓ Status: ${tenant.status}`);
    console.log(`  ✓ Plan: ${tenant.plan}`);
    console.log(`  ✓ Organizations: ${tenant.organizationsCount}`);

    if (tenantBlueprint.organizations && tenantBlueprint.organizations.length > 0) {
      const org = tenantBlueprint.organizations[0];
      console.log(`  ✓ Organization: ${org.name}`);
      console.log(`    - Roles: ${org.roles?.length || 0}`);
      console.log(`    - Users: ${org.users?.length || 0}`);
      console.log(`    - Teams: ${org.teams?.length || 0}`);
    }

    console.log("");
    console.log("≡ƒôè Validation Successful");
    console.log("");
  } catch (error) {
    console.error(`✗ Validation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
