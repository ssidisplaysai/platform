/**
 * IdentityCompilerTests.mjs
 *
 * Test suite for Genesis Identity Compiler v1
 * Comprehensive coverage of identity, tenant, and organization compilation
 *
 * @module tools/genesis/tests/suites/IdentityCompilerTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
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
} from "../../compiler/IdentityBlueprintContract.mjs";
import { IdentityCompiler } from "../../compiler/IdentityCompiler.mjs";

export default async function IdentityCompilerTestSuite() {
  const suite = new TestSuite(
    "Identity Compiler Tests",
    "Test Genesis Identity & Tenant Platform v1 compilation"
  );

  // Test 1: Permission initialization
  suite.addTest("Permission initializes", async () => {
    const perm = new Permission({
      name: "users.read",
      resource: "users",
      action: "read"
    });
    if (!perm.id) throw new Error("Permission ID not set");
    if (perm.name !== "users.read") throw new Error("Permission name mismatch");
  });

  // Test 2: Permission validation
  suite.addTest("Permission validation works", async () => {
    const perm = new Permission({
      resource: "users",
      action: "read"
    });
    const result = perm.validate();
    if (result.isValid) throw new Error("Should fail - missing name");
    if (!result.errors.includes("Permission name is required")) {
      throw new Error("Expected error message not found");
    }
  });

  // Test 3: PermissionSet initialization
  suite.addTest("PermissionSet initializes", async () => {
    const pset = new PermissionSet({
      name: "Admin",
      permissions: [
        new Permission({ name: "p1", resource: "users", action: "read" })
      ]
    });
    if (!pset.id) throw new Error("PermissionSet ID not set");
    if (pset.permissions.length !== 1) throw new Error("Permissions not added");
  });

  // Test 4: PermissionSet validation
  suite.addTest("PermissionSet validation works", async () => {
    const pset = new PermissionSet({ name: "Empty" });
    const result = pset.validate();
    if (result.isValid) throw new Error("Should fail - no permissions");
  });

  // Test 5: Role initialization
  suite.addTest("Role initializes", async () => {
    const role = new Role({
      name: "Owner",
      level: 0,
      permissionSetId: "pset-123"
    });
    if (role.name !== "Owner") throw new Error("Role name mismatch");
    if (role.level !== 0) throw new Error("Role level mismatch");
  });

  // Test 6: Role hierarchy
  suite.addTest("Role hierarchy works", async () => {
    const ownerRole = new Role({ name: "Owner", level: 0 });
    const adminRole = new Role({ name: "Admin", level: 10 });
    if (!ownerRole.isOwner()) throw new Error("Owner role check failed");
    if (!adminRole.isAdmin()) throw new Error("Admin role check failed");
  });

  // Test 7: Role management permissions
  suite.addTest("Role management permissions work", async () => {
    const ownerRole = new Role({ name: "Owner", level: 0 });
    const memberRole = new Role({ name: "Member", level: 50 });
    if (!ownerRole.canManageRole(memberRole)) {
      throw new Error("Owner should be able to manage lower roles");
    }
  });

  // Test 8: Team initialization
  suite.addTest("Team initializes", async () => {
    const team = new Team({
      name: "Engineering",
      members: ["user-1", "user-2"]
    });
    if (team.name !== "Engineering") throw new Error("Team name mismatch");
    if (team.members.length !== 2) throw new Error("Team members not added");
  });

  // Test 9: Team member management
  suite.addTest("Team member management works", async () => {
    const team = new Team({ name: "Team", members: ["user-1"] });
    team.addMember("user-2");
    if (team.members.length !== 2) throw new Error("Member not added");
    team.removeMember("user-1");
    if (team.members.includes("user-1")) throw new Error("Member not removed");
  });

  // Test 10: User initialization
  suite.addTest("User initializes", async () => {
    const user = new User({
      email: "test@example.com",
      firstName: "Test",
      lastName: "User"
    });
    if (user.email !== "test@example.com") throw new Error("Email mismatch");
    if (user.getFullName() !== "Test User") throw new Error("Full name mismatch");
  });

  // Test 11: User validation
  suite.addTest("User validation works", async () => {
    const user = new User({ email: "invalid", firstName: "Test" });
    const result = user.validate();
    if (result.isValid) throw new Error("Should fail - invalid email");
  });

  // Test 12: User role management
  suite.addTest("User role management works", async () => {
    const user = new User({
      email: "test@example.com",
      firstName: "Test",
      lastName: "User"
    });
    user.addRole("role-1");
    if (!user.hasRole("role-1")) throw new Error("Role not added");
    if (!user.roles.includes("role-1")) throw new Error("Role not in list");
  });

  // Test 13: SecurityContext initialization
  suite.addTest("SecurityContext initializes", async () => {
    const ctx = new SecurityContext({
      userId: "user-1",
      roles: ["admin"],
      permissions: [
        { resource: "users", action: "read" }
      ]
    });
    if (!ctx.userId) throw new Error("User ID not set");
  });

  // Test 14: SecurityContext permissions
  suite.addTest("SecurityContext permissions work", async () => {
    const ctx = new SecurityContext({
      userId: "user-1",
      roles: ["admin"],
      permissions: [
        { resource: "users", action: "read" },
        { resource: "users", action: "write" }
      ]
    });
    if (!ctx.hasPermission("users", "read")) {
      throw new Error("Permission check failed");
    }
    if (ctx.hasPermission("users", "delete")) {
      throw new Error("Should not have delete permission");
    }
  });

  // Test 15: OrganizationBlueprint initialization
  suite.addTest("OrganizationBlueprint initializes", async () => {
    const org = new OrganizationBlueprint({
      name: "Test Org",
      industry: "Technology"
    });
    if (org.name !== "Test Org") throw new Error("Name mismatch");
    if (org.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 16: OrganizationBlueprint validation
  suite.addTest("OrganizationBlueprint validation works", async () => {
    const org = new OrganizationBlueprint({ name: "" });
    const result = org.validate();
    if (result.isValid) throw new Error("Should fail - no name");
  });

  // Test 17: OrganizationBlueprint status transitions
  suite.addTest("OrganizationBlueprint status transitions work", async () => {
    const org = new OrganizationBlueprint({ name: "Test" });
    org.markValidated();
    if (org.status !== "validated") throw new Error("Status should be validated");
    org.markDeployed();
    if (org.status !== "deployed") throw new Error("Status should be deployed");
  });

  // Test 18: TenantBlueprint initialization
  suite.addTest("TenantBlueprint initializes", async () => {
    const tenant = new TenantBlueprint({
      name: "Test Tenant",
      plan: "professional"
    });
    if (tenant.name !== "Test Tenant") throw new Error("Name mismatch");
    if (tenant.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 19: TenantBlueprint status transitions
  suite.addTest("TenantBlueprint status transitions work", async () => {
    const tenant = new TenantBlueprint({ name: "Test" });
    tenant.markValidated();
    tenant.markDeployed();
    tenant.markActive();
    if (tenant.status !== "active") throw new Error("Status should be active");
    if (!tenant.activatedAt) throw new Error("Activation timestamp not set");
  });

  // Test 20: IdentityBlueprint initialization
  suite.addTest("IdentityBlueprint initializes", async () => {
    const identity = new IdentityBlueprint({
      maxTenants: 500,
      isolationLevel: "strong"
    });
    if (identity.version !== "1.0.0") throw new Error("Version mismatch");
    if (identity.status !== "draft") throw new Error("Status should be draft");
    if (identity.globalConfig.maxTenants !== 500) throw new Error("Max tenants mismatch");
  });

  // Test 21: IdentityBlueprint tenant management
  suite.addTest("IdentityBlueprint tenant management works", async () => {
    const identity = new IdentityBlueprint({ maxTenants: 1 });
    const tenant = new TenantBlueprint({ name: "Test" });
    identity.addTenant(tenant);
    if (identity.tenants.length !== 1) throw new Error("Tenant not added");
  });

  // Test 22: IdentityBlueprint tenant limit
  suite.addTest("IdentityBlueprint respects tenant limit", async () => {
    const identity = new IdentityBlueprint({ maxTenants: 1 });
    const tenant1 = new TenantBlueprint({ name: "Test1" });
    const tenant2 = new TenantBlueprint({ name: "Test2" });
    identity.addTenant(tenant1);
    try {
      identity.addTenant(tenant2);
      throw new Error("Should have thrown error for limit");
    } catch (e) {
      if (!e.message.includes("Maximum number of tenants")) {
        throw new Error("Wrong error message");
      }
    }
  });

  // Test 23: IdentityCompiler initialization
  suite.addTest("IdentityCompiler initializes", async () => {
    const compiler = new IdentityCompiler("test-tenant");
    if (compiler.tenantName !== "test-tenant") throw new Error("Tenant name mismatch");
    if (!compiler.tenantId) throw new Error("Tenant ID not set");
  });

  // Test 24: IdentityCompiler creates default roles
  suite.addTest("IdentityCompiler creates default roles", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    if (compiler.defaultRoles.length !== 4) throw new Error("Should have 4 default roles");
    if (compiler.defaultRoles[0].name !== "Owner") throw new Error("First role should be Owner");
  });

  // Test 25: IdentityCompiler creates organization
  suite.addTest("IdentityCompiler creates organization", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    if (!compiler.organization) throw new Error("Organization not created");
    if (compiler.organization.roles.length === 0) throw new Error("No roles in organization");
  });

  // Test 26: IdentityCompiler adds users
  suite.addTest("IdentityCompiler adds users", async () => {
    const compiler = new IdentityCompiler("test", {
      ownerEmail: "owner@test.com",
      ownerFirstName: "Owner",
      ownerLastName: "User"
    });
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    compiler.addUsersToOrganization();
    if (compiler.organization.users.length === 0) throw new Error("No users created");
    if (compiler.organization.users[0].email !== "owner@test.com") {
      throw new Error("Owner user not created correctly");
    }
  });

  // Test 27: IdentityCompiler creates tenant
  suite.addTest("IdentityCompiler creates tenant", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    compiler.addUsersToOrganization();
    compiler.createTenant();
    if (!compiler.tenant) throw new Error("Tenant not created");
    if (compiler.tenant.organizations.length === 0) throw new Error("No organizations in tenant");
  });

  // Test 28: IdentityCompiler validation
  suite.addTest("IdentityCompiler validates blueprints", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    compiler.addUsersToOrganization();
    compiler.createTenant();
    compiler.validateBlueprints();
    if (compiler.errors.length > 0) throw new Error("Unexpected validation errors");
  });

  // Test 29: IdentityCompiler assembles identity blueprint
  suite.addTest("IdentityCompiler assembles identity blueprint", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    compiler.addUsersToOrganization();
    compiler.createTenant();
    compiler.validateBlueprints();
    compiler.assembleIdentityBlueprint();
    if (!compiler.blueprint) throw new Error("Blueprint not assembled");
    if (compiler.blueprint.tenants.length === 0) throw new Error("No tenants in blueprint");
  });

  // Test 30: IdentityCompiler getResults
  suite.addTest("IdentityCompiler getResults works", async () => {
    const compiler = new IdentityCompiler("test");
    compiler.createDefaultRolesAndPermissions();
    compiler.createOrganization();
    compiler.addUsersToOrganization();
    compiler.createTenant();
    compiler.validateBlueprints();
    const results = compiler.getResults();
    if (!results.tenantId) throw new Error("Results missing tenantId");
    if (results.status !== "success") throw new Error("Status should be success");
  });

  return suite;
}
