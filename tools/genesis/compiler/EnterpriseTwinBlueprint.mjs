/**
 * EnterpriseTwinBlueprint - Genesis Enterprise Digital Twin v1
 *
 * Canonical Intermediate Representation (IR) for the Enterprise Digital Twin.
 * Provides a real-time graph representation of the entire runtime state,
 * including organizations, applications, modules, objects, and active processes.
 *
 * @module tools/genesis/compiler/EnterpriseTwinBlueprint.mjs
 */

import { randomBytes } from "crypto";

/**
 * TwinNode
 * Base class for all nodes in the enterprise graph
 */
export class TwinNode {
  constructor(data = {}) {
    this.id = data.id || `node-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "";
    this.type = data.type || "unknown"; // organization, application, module, object, workflow, automation, agent, component
    this.version = data.version || "1.0.0";
    this.status = data.status || "active"; // active, inactive, archived, error
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastAccessedAt = data.lastAccessedAt || null;

    // Metrics
    this.metrics = {
      accessCount: data.accessCount || 0,
      updateCount: data.updateCount || 0,
      errorCount: data.errorCount || 0,
      avgResponseTime: data.avgResponseTime || 0
    };

    // Health status
    this.health = data.health || "healthy"; // healthy, degraded, unhealthy, unknown
    this.healthScore = data.healthScore || 100; // 0-100
  }

  validate() {
    const errors = [];
    if (!this.id) errors.push("Node ID is required");
    if (!this.name) errors.push("Node name is required");
    if (!this.type) errors.push("Node type is required");
    return { isValid: errors.length === 0, errors };
  }

  updateMetrics(metrics = {}) {
    this.metrics = { ...this.metrics, ...metrics };
    this.updatedAt = new Date().toISOString();
  }

  updateHealth(health, score) {
    this.health = health;
    this.healthScore = Math.max(0, Math.min(100, score));
  }

  access() {
    this.metrics.accessCount++;
    this.lastAccessedAt = new Date().toISOString();
  }

  recordError() {
    this.metrics.errorCount++;
    if (this.healthScore > 10) {
      this.healthScore -= 10;
    }
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      health: this.health,
      healthScore: this.healthScore,
      createdAt: this.createdAt,
      metrics: this.metrics
    };
  }
}

/**
 * TwinRelationship
 * Represents connections between nodes
 */
export class TwinRelationship {
  constructor(data = {}) {
    this.id = `rel-${randomBytes(4).toString("hex")}`;
    this.sourceId = data.sourceId || "";
    this.targetId = data.targetId || "";
    this.type = data.type || "relates"; // contains, uses, depends, publishes, subscribes, executes, triggers
    this.label = data.label || "";
    this.strength = data.strength || "normal"; // weak, normal, strong
    this.bidirectional = data.bidirectional === true;
    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.sourceId) errors.push("Source ID is required");
    if (!this.targetId) errors.push("Target ID is required");
    if (!this.type) errors.push("Relationship type is required");
    return { isValid: errors.length === 0, errors };
  }

  getSummary() {
    return {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: this.type,
      label: this.label,
      strength: this.strength
    };
  }
}

/**
 * OrganizationNode
 * Represents an organization in the twin
 */
export class OrganizationNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "organization";
    this.tenantId = data.tenantId || "";
    this.industry = data.industry || "";
    this.userCount = data.userCount || 0;
    this.teamCount = data.teamCount || 0;
  }
}

/**
 * ApplicationNode
 * Represents a deployed application
 */
export class ApplicationNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "application";
    this.organizationId = data.organizationId || "";
    this.moduleCount = data.moduleCount || 0;
    this.apiCount = data.apiCount || 0;
  }
}

/**
 * ModuleNode
 * Represents a deployed module
 */
export class ModuleNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "module";
    this.applicationId = data.applicationId || "";
    this.objectCount = data.objectCount || 0;
    this.workflowCount = data.workflowCount || 0;
    this.automationCount = data.automationCount || 0;
  }
}

/**
 * ObjectNode
 * Represents a domain object
 */
export class ObjectNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "object";
    this.moduleId = data.moduleId || "";
    this.schema = data.schema || {};
    this.instanceCount = data.instanceCount || 0;
  }
}

/**
 * WorkflowNode
 * Represents an active workflow execution
 */
export class WorkflowNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "workflow";
    this.moduleId = data.moduleId || "";
    this.instanceId = data.instanceId || "";
    this.stage = data.stage || "initialized"; // initialized, running, paused, completed, failed
    this.progress = data.progress || 0;
    this.executionTime = data.executionTime || 0;
  }
}

/**
 * AutomationNode
 * Represents an active automation
 */
export class AutomationNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "automation";
    this.moduleId = data.moduleId || "";
    this.trigger = data.trigger || "";
    this.executionCount = data.executionCount || 0;
    this.lastExecutedAt = data.lastExecutedAt || null;
  }
}

/**
 * AIAgentNode
 * Represents an active AI agent
 */
export class AIAgentNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "agent";
    this.moduleId = data.moduleId || "";
    this.capability = data.capability || "";
    this.model = data.model || "";
    this.requestCount = data.requestCount || 0;
    this.averageLatency = data.averageLatency || 0;
  }
}

/**
 * RuntimeComponentNode
 * Represents a runtime component (engine, bus, container)
 */
export class RuntimeComponentNode extends TwinNode {
  constructor(data = {}) {
    super(data);
    this.type = "component";
    this.componentType = data.componentType || "engine"; // engine, bus, container, broker
    this.uptime = data.uptime || 0;
    this.memoryUsage = data.memoryUsage || 0;
    this.cpuUsage = data.cpuUsage || 0;
  }
}

/**
 * EnterpriseTwinGraph
 * Complete graph representation of the enterprise
 */
export class EnterpriseTwinGraph {
  constructor(data = {}) {
    this.graphId = `graph-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.version = "1.0.0";
    this.tenantId = data.tenantId || "default";
    this.organizationId = data.organizationId || "default";
    this.status = "draft"; // draft, building, active, degraded, unhealthy

    // Graph structure
    this.nodes = [];
    this.relationships = [];

    // Statistics
    this.stats = {
      nodeCount: 0,
      relationshipCount: 0,
      avgHealthScore: 100,
      totalMetrics: {
        totalAccess: 0,
        totalUpdates: 0,
        totalErrors: 0
      }
    };

    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
    this.lastUpdatedAt = new Date().toISOString();
    this.lastSyncedAt = data.lastSyncedAt || null;
  }

  /**
   * Add node to graph
   */
  addNode(node) {
    if (!this.nodes.find(n => n.id === node.id)) {
      this.nodes.push(node);
      this.updateStats();
    }
  }

  /**
   * Add relationship to graph
   */
  addRelationship(relationship) {
    if (!this.relationships.find(r => r.id === relationship.id)) {
      this.relationships.push(relationship);
      this.updateStats();
    }
  }

  /**
   * Get node by ID
   */
  getNode(nodeId) {
    return this.nodes.find(n => n.id === nodeId);
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type) {
    return this.nodes.filter(n => n.type === type);
  }

  /**
   * Get related nodes
   */
  getRelatedNodes(nodeId, relationshipType = null) {
    const rels = this.relationships.filter(r => r.sourceId === nodeId);
    if (relationshipType) {
      return rels.filter(r => r.type === relationshipType)
        .map(r => this.getNode(r.targetId))
        .filter(n => n);
    }
    return rels.map(r => this.getNode(r.targetId)).filter(n => n);
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.nodeCount = this.nodes.length;
    this.stats.relationshipCount = this.relationships.length;

    if (this.nodes.length > 0) {
      const totalHealth = this.nodes.reduce((sum, n) => sum + (n.healthScore || 100), 0);
      this.stats.avgHealthScore = Math.round(totalHealth / this.nodes.length);
    }

    this.stats.totalMetrics = {
      totalAccess: this.nodes.reduce((sum, n) => sum + (n.metrics?.accessCount || 0), 0),
      totalUpdates: this.nodes.reduce((sum, n) => sum + (n.metrics?.updateCount || 0), 0),
      totalErrors: this.nodes.reduce((sum, n) => sum + (n.metrics?.errorCount || 0), 0)
    };

    this.lastUpdatedAt = new Date().toISOString();
  }

  /**
   * Determine graph status based on health
   */
  updateStatus() {
    if (this.stats.avgHealthScore >= 90) {
      this.status = "active";
    } else if (this.stats.avgHealthScore >= 50) {
      this.status = "degraded";
    } else {
      this.status = "unhealthy";
    }
  }

  /**
   * Validate graph
   */
  validate() {
    const errors = [];

    if (this.nodes.length === 0) {
      errors.push("Graph must have at least one node");
    }

    for (const node of this.nodes) {
      const nodeValidation = node.validate();
      if (!nodeValidation.isValid) {
        errors.push(`Node ${node.id}: ${nodeValidation.errors.join(", ")}`);
      }
    }

    for (const rel of this.relationships) {
      const relValidation = rel.validate();
      if (!relValidation.isValid) {
        errors.push(`Relationship ${rel.id}: ${relValidation.errors.join(", ")}`);
      }

      // Verify nodes exist
      if (!this.getNode(rel.sourceId)) {
        errors.push(`Relationship references missing source node: ${rel.sourceId}`);
      }
      if (!this.getNode(rel.targetId)) {
        errors.push(`Relationship references missing target node: ${rel.targetId}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get graph summary
   */
  getSummary() {
    return {
      graphId: this.graphId,
      version: this.version,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      status: this.status,
      stats: this.stats,
      nodeBreakdown: {
        organizations: this.getNodesByType("organization").length,
        applications: this.getNodesByType("application").length,
        modules: this.getNodesByType("module").length,
        objects: this.getNodesByType("object").length,
        workflows: this.getNodesByType("workflow").length,
        automations: this.getNodesByType("automation").length,
        agents: this.getNodesByType("agent").length,
        components: this.getNodesByType("component").length
      },
      createdAt: this.createdAt,
      lastUpdatedAt: this.lastUpdatedAt,
      lastSyncedAt: this.lastSyncedAt
    };
  }

  /**
   * Get graph health report
   */
  getHealthReport() {
    const healthyNodes = this.nodes.filter(n => n.health === "healthy").length;
    const degradedNodes = this.nodes.filter(n => n.health === "degraded").length;
    const unhealthyNodes = this.nodes.filter(n => n.health === "unhealthy").length;

    return {
      overallHealth: this.stats.avgHealthScore,
      status: this.status,
      nodeHealth: {
        healthy: healthyNodes,
        degraded: degradedNodes,
        unhealthy: unhealthyNodes,
        total: this.nodes.length
      },
      errors: this.stats.totalMetrics.totalErrors,
      errorRate: this.nodes.length > 0 
        ? ((this.stats.totalMetrics.totalErrors / this.stats.totalMetrics.totalAccess) * 100).toFixed(2)
        : "N/A"
    };
  }
}

/**
 * EnterpriseTwinBlueprint
 * Canonical IR for the Enterprise Digital Twin
 */
export class EnterpriseTwinBlueprint {
  constructor(data = {}) {
    this.blueprintId = `twin-blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.version = "1.0.0";
    this.status = "draft"; // draft, validated, deployed, active
    this.tenantId = data.tenantId || "default";

    // Twin configuration
    this.config = {
      autoSync: data.autoSync !== false,
      syncInterval: data.syncInterval || 30000, // 30 seconds
      maxNodes: data.maxNodes || 10000,
      maxRelationships: data.maxRelationships || 50000,
      trackMetrics: data.trackMetrics !== false,
      trackHealth: data.trackHealth !== false
    };

    // Graph instance
    this.graph = null;

    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  /**
   * Initialize graph
   */
  initializeGraph(data = {}) {
    this.graph = new EnterpriseTwinGraph({
      tenantId: this.tenantId,
      ...data
    });
  }

  /**
   * Validate blueprint
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.tenantId) errors.push("Tenant ID is required");

    if (this.config.maxNodes < 100) {
      warnings.push("Max nodes is very low");
    }

    if (this.graph) {
      const graphValidation = this.graph.validate();
      if (!graphValidation.isValid) {
        errors.push(...graphValidation.errors);
      }
    } else {
      warnings.push("Graph not initialized");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Mark as validated
   */
  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  /**
   * Mark as deployed
   */
  markDeployed() {
    if (this.status === "validated") {
      this.status = "deployed";
    }
  }

  /**
   * Mark as active
   */
  markActive() {
    if (this.status === "deployed") {
      this.status = "active";
    }
  }

  /**
   * Get blueprint summary
   */
  getSummary() {
    return {
      blueprintId: this.blueprintId,
      version: this.version,
      status: this.status,
      tenantId: this.tenantId,
      config: this.config,
      graphStatus: this.graph?.status || "uninitialized",
      graphId: this.graph?.graphId || null,
      createdAt: this.createdAt
    };
  }
}
