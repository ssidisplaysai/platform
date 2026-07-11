/**
 * RuntimeExecutionContext.mjs
 *
 * Tenant-aware execution context for all Genesis runtime operations.
 * Scopes all commands, queries, events, workflows, automations, and AI agents within
 * a specific tenant, organization, user, and security context.
 *
 * @module tools/genesis/runtime/RuntimeExecutionContext.mjs
 */

import { randomBytes } from "crypto";

/**
 * RuntimeExecutionContext
 * Encapsulates all contextual information for a runtime operation
 */
export class RuntimeExecutionContext {
  constructor(data = {}) {
    // Unique identifiers
    this.executionId = `exec-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.correlationId = data.correlationId || this.executionId;
    this.traceId = data.traceId || this.executionId;

    // Tenant & Organization scoping
    this.tenantId = data.tenantId || "default";
    this.organizationId = data.organizationId || "default";
    this.teamId = data.teamId || null;

    // User & Identity scoping
    this.userId = data.userId || "system";
    this.userEmail = data.userEmail || "";
    this.userName = data.userName || "System";

    // Roles and permissions
    this.roles = data.roles || [];
    this.permissions = data.permissions || [];

    // Security context
    this.securityLevel = data.securityLevel || "standard"; // standard, enhanced, maximum
    this.mfaVerified = data.mfaVerified === true;
    this.ipAddress = data.ipAddress || "";
    this.userAgent = data.userAgent || "";

    // Operational context
    this.operation = data.operation || "unknown"; // command, query, event, workflow, automation, agent
    this.operationId = data.operationId || null;
    this.operationName = data.operationName || "";

    // Execution environment
    this.locale = data.locale || "en-US";
    this.timezone = data.timezone || "UTC";
    this.executionEnvironment = data.executionEnvironment || "production"; // production, staging, test, development
    this.executionMode = data.executionMode || "live"; // live, dryRun, simulation
    this.dryRun = data.dryRun === true;

    // Execution metadata
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.duration = null;
    this.actor = data.actor || "system";
    this.source = data.source || "cli"; // cli, api, webhook, automation, ai, internal

    // Audit and compliance
    this.auditEnabled = data.auditEnabled !== false;
    this.auditLevel = data.auditLevel || "standard"; // minimal, standard, detailed, comprehensive
    this.complianceContext = data.complianceContext || {};

    // Execution state
    this.status = "initialized"; // initialized, executing, completed, failed, cancelled
    this.errors = [];
    this.warnings = [];
    this.info = [];

    // Additional context data
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
  }

  /**
   * Validate execution context has required fields
   */
  validate() {
    const errors = [];

    if (!this.tenantId) errors.push("tenantId is required");
    if (!this.organizationId) errors.push("organizationId is required");
    if (!this.userId) errors.push("userId is required");

    if (!["standard", "enhanced", "maximum"].includes(this.securityLevel)) {
      errors.push("Invalid security level");
    }

    if (!["live", "dryRun", "simulation"].includes(this.executionMode)) {
      errors.push("Invalid execution mode");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(resource, action) {
    return this.permissions.some(p => p.resource === resource && p.action === action);
  }

  /**
   * Check if user has a specific role
   */
  hasRole(roleName) {
    return this.roles.includes(roleName);
  }

  /**
   * Check if user is admin or owner
   */
  isAdmin() {
    return this.roles.some(r => ["owner", "admin", "administrator"].includes(r.toLowerCase()));
  }

  /**
   * Check if user is owner
   */
  isOwner() {
    return this.roles.includes("owner");
  }

  /**
   * Mark execution as started
   */
  markStarted() {
    this.status = "executing";
    this.startTime = new Date().toISOString();
  }

  /**
   * Mark execution as completed
   */
  markCompleted() {
    this.status = "completed";
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Mark execution as failed
   */
  markFailed(error) {
    this.status = "failed";
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
    if (error) {
      this.errors.push(error);
    }
  }

  /**
   * Mark execution as cancelled
   */
  markCancelled() {
    this.status = "cancelled";
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Add an error
   */
  addError(error) {
    this.errors.push(error);
  }

  /**
   * Add a warning
   */
  addWarning(warning) {
    this.warnings.push(warning);
  }

  /**
   * Add info
   */
  addInfo(info) {
    this.info.push(info);
  }

  /**
   * Check if execution had errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get execution summary
   */
  getSummary() {
    return {
      executionId: this.executionId,
      correlationId: this.correlationId,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      userId: this.userId,
      userName: this.userName,
      operation: this.operation,
      operationName: this.operationName,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      errors: this.errors.length,
      warnings: this.warnings.length,
      info: this.info.length,
      dryRun: this.dryRun
    };
  }

  /**
   * Create child context (for nested operations)
   */
  createChildContext(data = {}) {
    return new RuntimeExecutionContext({
      ...this,
      ...data,
      correlationId: this.correlationId, // Preserve correlation ID
      traceId: this.traceId, // Preserve trace ID
      executionId: `exec-${Date.now()}-${randomBytes(4).toString("hex")}`, // New execution ID
      parentExecutionId: this.executionId
    });
  }

  /**
   * Serialize for logging/audit
   */
  toJSON() {
    return {
      executionId: this.executionId,
      correlationId: this.correlationId,
      traceId: this.traceId,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      teamId: this.teamId,
      userId: this.userId,
      userEmail: this.userEmail,
      userName: this.userName,
      roles: this.roles,
      operation: this.operation,
      operationName: this.operationName,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      securityLevel: this.securityLevel,
      mfaVerified: this.mfaVerified,
      executionEnvironment: this.executionEnvironment,
      executionMode: this.executionMode,
      dryRun: this.dryRun,
      source: this.source,
      actor: this.actor,
      locale: this.locale,
      timezone: this.timezone,
      errors: this.errors,
      warnings: this.warnings,
      auditEnabled: this.auditEnabled
    };
  }
}

/**
 * RuntimeExecutionContextFactory
 * Factory for creating pre-configured execution contexts
 */
export class RuntimeExecutionContextFactory {
  /**
   * Create context for CLI command execution
   */
  static createCLIContext(tenantId, userId, operation, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId: data.organizationId || "default",
      userId,
      userName: data.userName || userId,
      operation: "command",
      operationName: operation,
      source: "cli",
      actor: userId,
      executionEnvironment: data.executionEnvironment || "production",
      ...data
    });
  }

  /**
   * Create context for API request execution
   */
  static createAPIContext(tenantId, userId, operation, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId: data.organizationId || "default",
      userId,
      userName: data.userName || userId,
      operation: "api",
      operationName: operation,
      source: "api",
      actor: userId,
      ipAddress: data.ipAddress || "",
      userAgent: data.userAgent || "",
      ...data
    });
  }

  /**
   * Create context for internal operation execution
   */
  static createInternalContext(tenantId, operation, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId: data.organizationId || "default",
      userId: "system",
      userName: "System",
      operation: "internal",
      operationName: operation,
      source: "internal",
      actor: "system",
      ...data
    });
  }

  /**
   * Create context for automation execution
   */
  static createAutomationContext(tenantId, organizationId, automationName, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId,
      userId: "automation",
      userName: "Automation Engine",
      operation: "automation",
      operationName: automationName,
      source: "automation",
      actor: "automation",
      ...data
    });
  }

  /**
   * Create context for AI agent execution
   */
  static createAIAgentContext(tenantId, organizationId, agentName, userId, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId,
      userId,
      operation: "agent",
      operationName: agentName,
      source: "ai",
      actor: userId,
      ...data
    });
  }

  /**
   * Create context for workflow execution
   */
  static createWorkflowContext(tenantId, organizationId, workflowName, triggeredBy, data = {}) {
    return new RuntimeExecutionContext({
      tenantId,
      organizationId,
      userId: triggeredBy,
      operation: "workflow",
      operationName: workflowName,
      source: data.source || "internal",
      actor: triggeredBy,
      ...data
    });
  }
}
