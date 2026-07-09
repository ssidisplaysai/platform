/**
 * IdentityCompiler - Genesis Identity & Tenant Platform v1
 *
 * Compiles identity and tenant configurations into deployable blueprints.
 * Supports multi-tenant architecture with organization and user scoping.
 *
 * @module tools/genesis/compiler/IdentityCompiler.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  Permission,
  PermissionSet,
  Role,
  Team,
  User,
  SecurityContext,
  OrganizationBlueprint,
  TenantBlueprint,
  IdentityBlueprint
} from "./IdentityBlueprintContract.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class IdentityCompiler {
  constructor(tenantName = "default", options = {}) {
    this.tenantName = tenantName;
    this.tenantId = `tenant-${tenantName.toLowerCase().replace(/\s+/g, "-")}`;
    this.options = options;

    this.blueprint = null;
    this.tenant = null;
    this.organization = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Complete compilation pipeline
   */
  async compile() {
    try {
      console.log(`\n≡ƒÜÇ Genesis Identity Compiler v1 - Creating '${this.tenantName}'`);
      console.log("");

      // Stage 1: Create default roles and permissions
      console.log("Stage 1: Create Default Roles & Permissions");
      this.createDefaultRolesAndPermissions();
      console.log(`  ✓ Roles and permissions created`);

      // Stage 2: Create organization blueprint
      console.log("Stage 2: Create Organization Blueprint");
      this.createOrganization();
      console.log(`  ✓ Organization blueprint created`);

      // Stage 3: Add users to organization
      console.log("Stage 3: Add Users to Organization");
      this.addUsersToOrganization();
      console.log(`  ✓ Users added to organization`);

      // Stage 4: Create tenant blueprint
      console.log("Stage 4: Create Tenant Blueprint");
      this.createTenant();
      console.log(`  ✓ Tenant blueprint created`);

      // Stage 5: Validate blueprints
      console.log("Stage 5: Validate Blueprints");
      this.validateBlueprints();
      console.log(`  ✓ Blueprints validated`);

      // Stage 6: Create identity blueprint
      console.log("Stage 6: Assemble Identity Blueprint");
      this.assembleIdentityBlueprint();
      console.log(`  ✓ Identity blueprint assembled`);

      // Stage 7: Generate artifacts
      console.log("Stage 7: Generate Artifacts");
      await this.generateArtifacts();
      console.log(`  ✓ Artifacts generated`);

      // Stage 8: Create registry
      console.log("Stage 8: Create Registry");
      this.createRegistry();
      console.log(`  ✓ Registry created`);

      console.log("\n≡ƒôè COMPILATION COMPLETED");
      console.log("");
      console.log(`  Tenant: ${this.tenant.name}`);
      console.log(`  Organizations: ${this.tenant.organizations.length}`);
      console.log(`  Roles: ${this.tenant.organizations[0]?.roles.length || 0}`);
      console.log(`  Users: ${this.tenant.organizations[0]?.users.length || 0}`);
      console.log("");

      this.tenant.markValidated();
      this.tenant.markDeployed();
      this.tenant.markActive();

      return true;
    } catch (error) {
      console.error(`\n✗ Compilation failed: ${error.message}`);
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Stage 1: Create default roles and permissions
   */
  createDefaultRolesAndPermissions() {
    // Create permission sets
    const adminPermissions = new PermissionSet({
      name: "Administrator",
      description: "Full administrative access",
      permissions: [
        new Permission({
          name: "users.manage",
          resource: "users",
          action: "manage",
          scope: "organization"
        }),
        new Permission({
          name: "roles.manage",
          resource: "roles",
          action: "manage",
          scope: "organization"
        }),
        new Permission({
          name: "settings.manage",
          resource: "settings",
          action: "manage",
          scope: "organization"
        }),
        new Permission({
          name: "audit.read",
          resource: "audit",
          action: "read",
          scope: "organization"
        })
      ]
    });

    const userPermissions = new PermissionSet({
      name: "User",
      description: "Standard user access",
      permissions: [
        new Permission({
          name: "profile.read",
          resource: "profile",
          action: "read",
          scope: "user"
        }),
        new Permission({
          name: "profile.write",
          resource: "profile",
          action: "write",
          scope: "user"
        }),
        new Permission({
          name: "data.read",
          resource: "data",
          action: "read",
          scope: "organization"
        })
      ]
    });

    this.defaultPermissionSets = [adminPermissions, userPermissions];

    // Create roles
    this.defaultRoles = [
      new Role({
        name: "Owner",
        description: "Organization owner",
        level: 0,
        permissionSetId: adminPermissions.id,
        builtin: true
      }),
      new Role({
        name: "Administrator",
        description: "Organization administrator",
        level: 10,
        permissionSetId: adminPermissions.id,
        builtin: true
      }),
      new Role({
        name: "Member",
        description: "Organization member",
        level: 50,
        permissionSetId: userPermissions.id,
        builtin: true
      }),
      new Role({
        name: "Guest",
        description: "Guest user",
        level: 90,
        permissionSetId: userPermissions.id,
        builtin: true
      })
    ];
  }

  /**
   * Stage 2: Create organization blueprint
   */
  createOrganization() {
    this.organization = new OrganizationBlueprint({
      name: `${this.tenantName} Organization`,
      description: `Default organization for ${this.tenantName}`,
      industry: this.options.industry || "Technology",
      country: this.options.country || "US",
      timezone: this.options.timezone || "UTC",
      locale: this.options.locale || "en-US",
      maxUsers: this.options.maxUsers || 1000
    });

    // Add permission sets
    this.organization.permissionSets = this.defaultPermissionSets;

    // Add roles
    this.organization.roles = this.defaultRoles;
  }

  /**
   * Stage 3: Add users to organization
   */
  addUsersToOrganization() {
    // Create default owner user
    const ownerUser = new User({
      email: this.options.ownerEmail || "admin@example.com",
      firstName: this.options.ownerFirstName || "Admin",
      lastName: this.options.ownerLastName || "User",
      status: "active"
    });

    // Add owner role
    const ownerRole = this.defaultRoles.find(r => r.name === "Owner");
    if (ownerRole) {
      ownerUser.addRole(ownerRole.id);
    }

    // Create default team
    const defaultTeam = new Team({
      name: "Default Team",
      description: "Default organization team"
    });
    defaultTeam.addMember(ownerUser.id);
    ownerUser.teams.push(defaultTeam.id);

    this.organization.users.push(ownerUser);
    this.organization.teams.push(defaultTeam);

    // Add additional users if provided
    if (this.options.users && Array.isArray(this.options.users)) {
      for (const userData of this.options.users) {
        const user = new User({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          status: userData.status || "active"
        });

        // Add roles
        if (userData.roles && Array.isArray(userData.roles)) {
          for (const roleName of userData.roles) {
            const role = this.defaultRoles.find(r => r.name === roleName);
            if (role) {
              user.addRole(role.id);
            }
          }
        }

        this.organization.users.push(user);
      }
    }
  }

  /**
   * Stage 4: Create tenant blueprint
   */
  createTenant() {
    this.tenant = new TenantBlueprint({
      name: this.tenantName,
      displayName: this.options.displayName || this.tenantName,
      description: this.options.description || `Genesis Tenant: ${this.tenantName}`,
      plan: this.options.plan || "professional",
      edition: this.options.edition || "cloud",
      maxOrganizations: this.options.maxOrganizations || 10,
      maxUsers: this.options.maxUsers || 10000
    });

    // Add organization
    this.tenant.organizations.push(this.organization);
  }

  /**
   * Stage 5: Validate blueprints
   */
  validateBlueprints() {
    // Validate organization
    const orgValidation = this.organization.validate();
    if (!orgValidation.isValid) {
      this.errors.push(...orgValidation.errors);
    }
    this.warnings.push(...orgValidation.warnings);

    // Validate tenant
    const tenantValidation = this.tenant.validate();
    if (!tenantValidation.isValid) {
      this.errors.push(...tenantValidation.errors);
    }
    this.warnings.push(...tenantValidation.warnings);

    if (this.errors.length > 0) {
      throw new Error(`Validation failed: ${this.errors.join(", ")}`);
    }
  }

  /**
   * Stage 6: Assemble identity blueprint
   */
  assembleIdentityBlueprint() {
    this.blueprint = new IdentityBlueprint({
      maxTenants: this.options.maxTenants || 1000,
      defaultPlan: this.options.defaultPlan || "professional",
      isolationLevel: this.options.isolationLevel || "strong",
      mfaRequired: this.options.mfaRequired === true
    });

    this.blueprint.addTenant(this.tenant);
    this.blueprint.markValidated();
    this.blueprint.markDeployed();
  }

  /**
   * Stage 7: Generate artifacts
   */
  async generateArtifacts() {
    const outputDir = join(projectRoot, "out/generated/identities", this.tenantId);
    mkdirSync(outputDir, { recursive: true });

    // Write identity blueprint
    writeFileSync(
      join(outputDir, `${this.tenantId}.identity-blueprint.json`),
      JSON.stringify(this.blueprint.getSummary(), null, 2)
    );

    // Write tenant blueprint
    writeFileSync(
      join(outputDir, `${this.tenantId}.tenant-blueprint.json`),
      JSON.stringify(this.tenant.getSummary(), null, 2)
    );

    // Write organization blueprint
    writeFileSync(
      join(outputDir, `${this.tenantId}.organization-blueprint.json`),
      JSON.stringify(this.organization.getSummary(), null, 2)
    );

    // Write full blueprints for reference
    writeFileSync(
      join(outputDir, `${this.tenantId}.identity-full.json`),
      JSON.stringify(this.blueprint, null, 2)
    );

    writeFileSync(
      join(outputDir, `${this.tenantId}.tenant-full.json`),
      JSON.stringify(this.tenant, null, 2)
    );

    // Write roles and permissions
    writeFileSync(
      join(outputDir, `${this.tenantId}.roles.json`),
      JSON.stringify(this.organization.roles, null, 2)
    );

    writeFileSync(
      join(outputDir, `${this.tenantId}.users.json`),
      JSON.stringify(this.organization.users, null, 2)
    );

    writeFileSync(
      join(outputDir, `${this.tenantId}.teams.json`),
      JSON.stringify(this.organization.teams, null, 2)
    );
  }

  /**
   * Stage 8: Create registry
   */
  createRegistry() {
    const registryDir = join(projectRoot, "out/generated/identities");
    mkdirSync(registryDir, { recursive: true });

    const registryPath = join(registryDir, "registry.json");
    let registry = { tenants: [] };

    if (existsSync(registryPath)) {
      try {
        const content = readFileSync(registryPath, "utf8");
        registry = JSON.parse(content);
      } catch (e) {
        // If parsing fails, start fresh
        registry = { tenants: [] };
      }
    }

    // Add or update tenant
    const existingIndex = registry.tenants.findIndex(t => t.id === this.tenantId);
    const tenantEntry = {
      id: this.tenantId,
      name: this.tenant.name,
      displayName: this.tenant.displayName,
      status: this.tenant.status,
      plan: this.tenant.plan,
      organizationsCount: this.tenant.organizations.length,
      createdAt: this.tenant.createdAt,
      activatedAt: this.tenant.activatedAt,
      blueprintFile: `${this.tenantId}.identity-full.json`,
      identityFile: `${this.tenantId}.identity-blueprint.json`
    };

    if (existingIndex >= 0) {
      registry.tenants[existingIndex] = tenantEntry;
    } else {
      registry.tenants.push(tenantEntry);
    }

    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }

  /**
   * Get compilation results
   */
  getResults() {
    return {
      tenantId: this.tenantId,
      tenantName: this.tenant.name,
      organizations: this.tenant.organizations.length,
      roles: this.organization.roles.length,
      users: this.organization.users.length,
      teams: this.organization.teams.length,
      errors: this.errors,
      warnings: this.warnings,
      status: this.errors.length === 0 ? "success" : "failed"
    };
  }
}
