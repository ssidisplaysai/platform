/**
 * Blueprint.mjs
 *
 * Represents an entity blueprint (model) built from YAML definition.
 *
 * Purpose:
 *   - Immutable blueprint object derived from GEDL
 *   - Provides structured entity metadata
 *   - Consumed by Planner and Compiler
 *   - Technology-neutral representation
 */

export class Blueprint {
  constructor(config) {
    if (!config.entity) {
      throw new Error("Blueprint requires entity name");
    }

    this.entity = config.entity;
    this.displayName = config.displayName || config.entity;
    this.pluralName = config.pluralName || `${config.entity}s`;
    this.description = config.description || "";
    this.fields = config.fields || {};
    this.relationships = config.relationships || {};
    this.capabilities = config.capabilities || {};
    this.lifecycle = config.lifecycle || {};
    this.metadata = config.metadata || {};
    this.source = config.source || "unknown";
    this.createdAt = config.createdAt || new Date().toISOString();

    // Freeze to enforce immutability
    Object.freeze(this.fields);
    Object.freeze(this.relationships);
    Object.freeze(this.capabilities);
    Object.freeze(this.lifecycle);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  /**
   * Get all fields
   */
  getFields() {
    return Object.entries(this.fields).map(([name, config]) => ({
      name,
      ...config,
    }));
  }

  /**
   * Get field count
   */
  getFieldCount() {
    return Object.keys(this.fields).length;
  }

  /**
   * Get all relationships
   */
  getRelationships() {
    return Object.entries(this.relationships).map(([name, config]) => ({
      name,
      ...config,
    }));
  }

  /**
   * Get relationship count
   */
  getRelationshipCount() {
    return Object.keys(this.relationships).length;
  }

  /**
   * Check if capability is enabled
   */
  hasCapability(capabilityName) {
    return this.capabilities[capabilityName]?.enabled === true;
  }

  /**
   * Get enabled capabilities
   */
  getEnabledCapabilities() {
    return Object.entries(this.capabilities)
      .filter(([, config]) => config.enabled === true)
      .map(([name]) => name);
  }

  /**
   * Check if field exists
   */
  hasField(fieldName) {
    return fieldName in this.fields;
  }

  /**
   * Get field by name
   */
  getField(fieldName) {
    return this.fields[fieldName] || null;
  }

  /**
   * Get required fields
   */
  getRequiredFields() {
    return this.getFields().filter((field) => field.required === true);
  }

  /**
   * Format blueprint for console output
   */
  formatForConsole() {
    const lines = [];

    lines.push("");
    lines.push(`Blueprint: ${this.entity}`);
    lines.push(`Display Name: ${this.displayName}`);
    lines.push(`Plural: ${this.pluralName}`);
    lines.push(`Description: ${this.description}`);
    lines.push("");
    lines.push(`Fields: ${this.getFieldCount()}`);
    lines.push(`Relationships: ${this.getRelationshipCount()}`);
    lines.push(`Capabilities: ${this.getEnabledCapabilities().join(", ")}`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Convert blueprint to JSON
   */
  toJSON() {
    return {
      entity: this.entity,
      displayName: this.displayName,
      pluralName: this.pluralName,
      description: this.description,
      fields: this.fields,
      relationships: this.relationships,
      capabilities: this.capabilities,
      lifecycle: this.lifecycle,
      metadata: this.metadata,
      source: this.source,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Create a blueprint
 */
export function createBlueprint(config) {
  return new Blueprint(config);
}
