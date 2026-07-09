/**
 * IdentityBlueprintContract - Genesis Identity & Tenant Platform v1
 *
 * Canonical Intermediate Representation (IR) for identity and tenant management.
 * Enables multi-tenant architecture with organization, user, role, and permission scoping.
 *
 * @module tools/genesis/compiler/IdentityBlueprintContract.mjs
 */

import { randomBytes } from "crypto";

/**
 * Permission
 * Define a single permission within a permission set
 */
export class Permission {
  constructor(data = {}) {
    this.id = `perm-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "";
    this.resource = data.resource || "";
    this.action = data.action || ""; // read, write, delete, manage, etc.
    this.scope = data.scope || "organization"; // organization, team, user
    this.description = data.description || "";
    this.constraints = data.constraints || {};
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Permission name is required");
    if (!this.resource) errors.push("Permission resource is required");
    if (!this.action) errors.push("Permission action is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * PermissionSet
 * Collection of permissions assigned to roles
 */
export class PermissionSet {
  constructor(data = {}) {
    this.id = `pset-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "";
    this.description = data.description || "";
    this.permissions = data.permissions || [];
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Permission set name is required");
    if (this.permissions.length === 0) {
      errors.push("Permission set must have at least one permission");
    }

    for (const perm of this.permissions) {
      const permValidation = perm.validate();
      if (!permValidation.isValid) {
        errors.push(...permValidation.errors);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

/**
 * Role
 * Organization role with assigned permissions
 */
export class Role {
  constructor(data = {}) {
    this.id = `role-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "";
    this.description = data.description || "";
    this.level = data.level || 0; // Hierarchy level: 0 (owner) to 99 (user)
    this.permissionSetId = data.permissionSetId || "";
    this.builtin = data.builtin === true;
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Role name is required");
    if (this.level < 0 || this.level > 99) {
      errors.push("Role level must be between 0 and 99");
    }
    return { isValid: errors.length === 0, errors };
  }

  isOwner() {
    return this.level === 0;
  }

  isAdmin() {
    return this.level <= 10;
  }

  canManageRole(otherRole) {
    // Higher level can manage lower level roles
    return this.level < otherRole.level;
  }
}

/**
 * Team
 * Organizational grouping within a tenant
 */
export class Team {
  constructor(data = {}) {
    this.id = `team-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "";
    this.description = data.description || "";
    this.parentTeamId = data.parentTeamId || null;
    this.members = data.members || [];
    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Team name is required");
    if (this.members.length === 0) {
      errors.push("Team must have at least one member");
    }
    return { isValid: errors.length === 0, errors };
  }

  addMember(userId) {
    if (!this.members.includes(userId)) {
      this.members.push(userId);
    }
  }

  removeMember(userId) {
    this.members = this.members.filter(id => id !== userId);
  }
}

/**
 * User
 * Identity user within a tenant
 */
export class User {
  constructor(data = {}) {
    this.id = `user-${randomBytes(4).toString("hex")}`;
    this.email = data.email || "";
    this.firstName = data.firstName || "";
    this.lastName = data.lastName || "";
    this.status = data.status || "active"; // active, inactive, suspended
    this.roles = data.roles || [];
    this.teams = data.teams || [];
    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || null;
  }

  validate() {
    const errors = [];
    if (!this.email) errors.push("Email is required");
    if (!this.email.includes("@")) errors.push("Invalid email format");
    if (!this.firstName) errors.push("First name is required");
    if (!this.lastName) errors.push("Last name is required");
    if (!["active", "inactive", "suspended"].includes(this.status)) {
      errors.push("Invalid user status");
    }
    return { isValid: errors.length === 0, errors };
  }

  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  addRole(roleId) {
    if (!this.roles.includes(roleId)) {
      this.roles.push(roleId);
    }
  }

  removeRole(roleId) {
    this.roles = this.roles.filter(id => id !== roleId);
  }

  hasRole(roleId) {
    return this.roles.includes(roleId);
  }
}

/**
 * SecurityContext
 * Execution context for user operations
 */
export class SecurityContext {
  constructor(data = {}) {
    this.id = `ctx-${randomBytes(4).toString("hex")}`;
    this.userId = data.userId || "";
    this.roles = data.roles || [];
    this.permissions = data.permissions || [];
    this.scope = data.scope || "organization"; // organization, team, user
    this.scopeId = data.scopeId || "";
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.userId) errors.push("User ID is required");
    if (this.roles.length === 0) errors.push("At least one role is required");
    return { isValid: errors.length === 0, errors };
  }

  hasPermission(resource, action) {
    return this.permissions.some(p => p.resource === resource && p.action === action);
  }

  canAccess(resource, action) {
    return this.hasPermission(resource, action);
  }
}

/**
 * OrganizationBlueprint
 * Canonical IR for organization configuration
 */
export class OrganizationBlueprint {
  constructor(data = {}) {
    this.blueprintId = `org-blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.id = `org-${data.name?.toLowerCase().replace(/\s+/g, "-") || "organization"}`;
    this.name = data.name || "";
    this.description = data.description || "";
    this.status = "draft"; // draft, validated, deployed
    this.industry = data.industry || "";
    this.country = data.country || "";
    this.timezone = data.timezone || "UTC";
    this.locale = data.locale || "en-US";

    // Structure
    this.roles = [];
    this.permissionSets = [];
    this.teams = [];
    this.users = [];

    // Configuration
    this.config = {
      maxUsers: data.maxUsers || 1000,
      maxTeams: data.maxTeams || 100,
      features: data.features || [],
      sso: data.sso || false,
      auditEnabled: data.auditEnabled !== false
    };

    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push("Organization name is required");
    if (this.roles.length === 0) warnings.push("Organization has no roles");
    if (this.users.length === 0) warnings.push("Organization has no users");

    for (const role of this.roles) {
      const roleValidation = role.validate();
      if (!roleValidation.isValid) {
        errors.push(...roleValidation.errors);
      }
    }

    for (const pset of this.permissionSets) {
      const psetValidation = pset.validate();
      if (!psetValidation.isValid) {
        errors.push(...psetValidation.errors);
      }
    }

    for (const user of this.users) {
      const userValidation = user.validate();
      if (!userValidation.isValid) {
        errors.push(...userValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  markDeployed() {
    if (this.status === "validated") {
      this.status = "deployed";
    }
  }

  getSummary() {
    return {
      blueprintId: this.blueprintId,
      id: this.id,
      name: this.name,
      status: this.status,
      rolesCount: this.roles.length,
      usersCount: this.users.length,
      teamsCount: this.teams.length,
      createdAt: this.createdAt
    };
  }
}

/**
 * TenantBlueprint
 * Canonical IR for tenant configuration
 */
export class TenantBlueprint {
  constructor(data = {}) {
    this.blueprintId = `tenant-blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.id = `tenant-${data.name?.toLowerCase().replace(/\s+/g, "-") || "tenant"}`;
    this.name = data.name || "";
    this.displayName = data.displayName || data.name;
    this.description = data.description || "";
    this.status = "draft"; // draft, validated, deployed, active, suspended
    this.plan = data.plan || "professional"; // starter, professional, enterprise
    this.edition = data.edition || "cloud";

    // Tenant configuration
    this.config = {
      maxOrganizations: data.maxOrganizations || 10,
      maxUsers: data.maxUsers || 10000,
      maxStorage: data.maxStorage || 1099511627776, // 1TB in bytes
      features: data.features || [],
      autoScaling: data.autoScaling !== false,
      multiregion: data.multiregion === true
    };

    // Organizations
    this.organizations = [];

    // Tenant-level settings
    this.settings = {
      branding: data.branding || {},
      security: data.security || {},
      integrations: data.integrations || {}
    };

    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
    this.activatedAt = data.activatedAt || null;
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push("Tenant name is required");
    if (!this.displayName) errors.push("Tenant display name is required");

    if (!["starter", "professional", "enterprise"].includes(this.plan)) {
      errors.push("Invalid tenant plan");
    }

    if (this.organizations.length === 0) {
      warnings.push("Tenant has no organizations");
    }

    for (const org of this.organizations) {
      const orgValidation = org.validate();
      if (!orgValidation.isValid) {
        errors.push(...orgValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  markDeployed() {
    if (this.status === "validated") {
      this.status = "deployed";
    }
  }

  markActive() {
    if (this.status === "deployed") {
      this.status = "active";
      this.activatedAt = new Date().toISOString();
    }
  }

  suspend() {
    this.status = "suspended";
  }

  getSummary() {
    return {
      blueprintId: this.blueprintId,
      id: this.id,
      name: this.name,
      status: this.status,
      plan: this.plan,
      organizationsCount: this.organizations.length,
      activatedAt: this.activatedAt,
      createdAt: this.createdAt
    };
  }
}

/**
 * IdentityBlueprint
 * Canonical IR for entire identity platform configuration
 */
export class IdentityBlueprint {
  constructor(data = {}) {
    this.blueprintId = `identity-blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.version = "1.0.0";
    this.status = "draft"; // draft, validated, deployed

    // Multi-tenant registry
    this.tenants = [];

    // Global configuration
    this.globalConfig = {
      maxTenants: data.maxTenants || 1000,
      defaultPlan: data.defaultPlan || "professional",
      multiTenancy: true,
      isolationLevel: data.isolationLevel || "strong" // strict, strong, moderate
    };

    // Security configuration
    this.securityConfig = {
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true,
        expirationDays: 90
      },
      mfaRequired: data.mfaRequired === true,
      sessionTimeout: 3600, // seconds
      maxLoginAttempts: 5,
      lockoutDuration: 900 // 15 minutes
    };

    // Audit configuration
    this.auditConfig = {
      enabled: true,
      retentionDays: 2555, // ~7 years
      logLoginAttempts: true,
      logDataAccess: true,
      logPermissionChanges: true
    };

    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (this.tenants.length === 0) {
      warnings.push("Identity blueprint has no tenants");
    }

    for (const tenant of this.tenants) {
      const tenantValidation = tenant.validate();
      if (!tenantValidation.isValid) {
        errors.push(...tenantValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  markDeployed() {
    if (this.status === "validated") {
      this.status = "deployed";
    }
  }

  addTenant(tenant) {
    if (this.tenants.length >= this.globalConfig.maxTenants) {
      throw new Error("Maximum number of tenants reached");
    }
    this.tenants.push(tenant);
  }

  getSummary() {
    return {
      blueprintId: this.blueprintId,
      version: this.version,
      status: this.status,
      tenantsCount: this.tenants.length,
      maxTenants: this.globalConfig.maxTenants,
      isolationLevel: this.globalConfig.isolationLevel,
      createdAt: this.createdAt
    };
  }
}
