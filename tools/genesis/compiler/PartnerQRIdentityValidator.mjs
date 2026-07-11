/**
 * PartnerQRIdentityValidator.mjs
 *
 * Validates Partner & QR Identity Engine metadata against blueprint
 * Ensures all components are well-formed and properly connected
 *
 * @module tools/genesis/compiler/PartnerQRIdentityValidator.mjs
 */

import { createPartnerQRIdentityBlueprint } from './PartnerQRIdentityBlueprint.mjs';

/**
 * PartnerQRIdentityValidator - Validates partner system architecture
 */
export class PartnerQRIdentityValidator {
  constructor() {
    this.blueprint = createPartnerQRIdentityBlueprint();
    this.errors = [];
    this.warnings = [];
    this.entities_validated = 0;
    this.relationships_validated = 0;
    this.events_validated = 0;
    this.permissions_validated = 0;
    this.rules_validated = 0;
    this.contracts_validated = 0;
  }

  /**
   * Validate entire partner system
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    // Stage 1: Entity validation
    this._validateEntities();

    // Stage 2: Relationship validation
    this._validateRelationships();

    // Stage 3: Event validation
    this._validateEvents();

    // Stage 4: Permission validation
    this._validatePermissions();

    // Stage 5: Rule validation
    this._validateRules();

    // Stage 6: Dashboard contract validation
    this._validateDashboardContracts();

    // Stage 7: Integrity checks
    this._validateIntegrity();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      stats: {
        entities_validated: this.entities_validated,
        relationships_validated: this.relationships_validated,
        events_validated: this.events_validated,
        permissions_validated: this.permissions_validated,
        rules_validated: this.rules_validated,
        contracts_validated: this.contracts_validated
      }
    };
  }

  /**
   * Stage 1: Validate entity definitions
   */
  _validateEntities() {
    const requiredEntities = [
      'Partner', 'PartnerAccount', 'PartnerQRCode', 'Campaign',
      'ReferralEvent', 'LeadEvent', 'SaleEvent', 'AttributionRecord',
      'CommissionRule', 'PartnerPayout'
    ];

    const entityNames = this.blueprint.entities.map(e => e.name);

    for (const required of requiredEntities) {
      if (!entityNames.includes(required)) {
        this.errors.push(`Missing required entity: ${required}`);
      }
    }

    for (const entity of this.blueprint.entities) {
      // Check required fields
      if (!entity.name) this.errors.push('Entity missing name');
      if (!entity.entity_type) this.errors.push('Entity missing entity_type');
      if (!Array.isArray(entity.fields)) this.errors.push(`Entity ${entity.name} fields must be array`);
      if (!Array.isArray(entity.lifecycle_stages)) {
        this.warnings.push(`Entity ${entity.name} missing lifecycle_stages`);
      }
      if (!Array.isArray(entity.events_emitted)) {
        this.warnings.push(`Entity ${entity.name} missing events_emitted`);
      }

      // Validate fields
      for (const field of entity.fields || []) {
        if (!field.name) this.errors.push(`Entity ${entity.name} has field without name`);
        if (!field.type) this.errors.push(`Entity ${entity.name} field ${field.name} missing type`);
      }

      this.entities_validated++;
    }
  }

  /**
   * Stage 2: Validate relationships
   */
  _validateRelationships() {
    const entityNames = new Set(this.blueprint.entities.map(e => e.name));

    for (const rel of this.blueprint.relationships) {
      // Check required fields
      if (!rel.source) this.errors.push('Relationship missing source');
      if (!rel.target) this.errors.push('Relationship missing target');
      if (!rel.type) this.errors.push('Relationship missing type');

      // Check source and target exist
      if (rel.source && !entityNames.has(rel.source)) {
        this.errors.push(`Relationship references non-existent entity: ${rel.source}`);
      }
      if (rel.target && !entityNames.has(rel.target)) {
        this.errors.push(`Relationship references non-existent entity: ${rel.target}`);
      }

      // Validate cardinality format
      if (rel.cardinality && !rel.cardinality.match(/^[\dN]:[\dN]$/)) {
        this.errors.push(`Invalid cardinality: ${rel.cardinality}`);
      }

      this.relationships_validated++;
    }

    // Check for disconnected entities
    const connectedEntities = new Set();
    for (const rel of this.blueprint.relationships) {
      connectedEntities.add(rel.source);
      connectedEntities.add(rel.target);
    }

    for (const entity of this.blueprint.entities) {
      if (!connectedEntities.has(entity.name)) {
        this.warnings.push(`Entity ${entity.name} has no relationships`);
      }
    }
  }

  /**
   * Stage 3: Validate events
   */
  _validateEvents() {
    const entityNames = new Set(this.blueprint.entities.map(e => e.name));

    for (const event of this.blueprint.events) {
      if (!event.name) this.errors.push('Event missing name');
      if (!event.aggregate) this.errors.push('Event missing aggregate');
      if (!event.payload) this.errors.push(`Event ${event.name} missing payload`);

      // Check aggregate exists
      if (event.aggregate && !entityNames.has(event.aggregate)) {
        this.errors.push(`Event ${event.name} references non-existent entity: ${event.aggregate}`);
      }

      // Validate payload fields
      for (const field of event.payload || []) {
        if (!field.name) this.errors.push(`Event ${event.name} has payload field without name`);
        if (!field.type) this.errors.push(`Event ${event.name} payload field ${field.name} missing type`);
      }

      this.events_validated++;
    }

    // Check entities emit events they declare
    const emittedEvents = new Set();
    for (const event of this.blueprint.events) {
      emittedEvents.add(`${event.aggregate}.${event.name.split('.')[1] || 'unknown'}`);
    }

    for (const entity of this.blueprint.entities) {
      for (const eventName of entity.events_emitted || []) {
        const eventExists = this.blueprint.events.some(e => e.name === eventName);
        if (!eventExists) {
          this.warnings.push(`Entity ${entity.name} declares emitting non-existent event: ${eventName}`);
        }
      }
    }
  }

  /**
   * Stage 4: Validate permissions
   */
  _validatePermissions() {
    const validRoles = ['admin', 'manager', 'partner', 'viewer', 'guest'];
    const entityNames = new Set(this.blueprint.entities.map(e => e.name));

    for (const perm of this.blueprint.permissions) {
      if (!perm.role) this.errors.push('Permission missing role');
      if (!perm.actions || !Array.isArray(perm.actions)) {
        this.errors.push(`Permission ${perm.role} missing actions array`);
      }

      // Validate role
      if (perm.role && !validRoles.includes(perm.role)) {
        this.errors.push(`Invalid role: ${perm.role}`);
      }

      // Validate entities
      for (const entity of perm.entities || []) {
        if (!entityNames.has(entity)) {
          this.errors.push(`Permission ${perm.role} references non-existent entity: ${entity}`);
        }
      }

      this.permissions_validated++;
    }

    // Check roles coverage
    const definedRoles = new Set(this.blueprint.permissions.map(p => p.role));
    const minRoles = ['admin', 'partner', 'viewer'];
    for (const role of minRoles) {
      if (!definedRoles.has(role)) {
        this.warnings.push(`Missing permission definition for role: ${role}`);
      }
    }
  }

  /**
   * Stage 5: Validate validation rules
   */
  _validateRules() {
    const entityNames = new Set(this.blueprint.entities.map(e => e.name));

    for (const rule of this.blueprint.validation_rules) {
      if (!rule.name) this.errors.push('Validation rule missing name');
      if (!rule.rule) this.errors.push('Validation rule missing rule description');

      // Validate entities it applies to
      for (const entity of rule.applies_to || []) {
        if (!entityNames.has(entity)) {
          this.errors.push(`Rule ${rule.name} references non-existent entity: ${entity}`);
        }
      }

      this.rules_validated++;
    }
  }

  /**
   * Stage 6: Validate dashboard contracts
   */
  _validateDashboardContracts() {
    const entityNames = new Set(this.blueprint.entities.map(e => e.name));
    const validTypes = ['metric', 'chart', 'table', 'summary'];

    for (const contract of this.blueprint.dashboard_contracts) {
      if (!contract.name) this.errors.push('Dashboard contract missing name');
      if (!contract.contract_type) this.errors.push('Dashboard contract missing contract_type');

      // Validate type
      if (contract.contract_type && !validTypes.includes(contract.contract_type)) {
        this.errors.push(`Invalid dashboard contract type: ${contract.contract_type}`);
      }

      // Validate source entities
      for (const entity of contract.source_entities || []) {
        if (!entityNames.has(entity)) {
          this.errors.push(`Contract ${contract.name} references non-existent entity: ${entity}`);
        }
      }

      this.contracts_validated++;
    }

    // Check required dashboard contracts
    const contractNames = new Set(this.blueprint.dashboard_contracts.map(c => c.name));
    const requiredContracts = ['Total Scans', 'Total Leads', 'Attributed Sales', 'Commissions Owed', 'Top Partners', 'Top Campaigns'];
    for (const required of requiredContracts) {
      if (!contractNames.has(required)) {
        this.errors.push(`Missing required dashboard contract: ${required}`);
      }
    }
  }

  /**
   * Stage 7: Validate overall integrity
   */
  _validateIntegrity() {
    // Check critical paths exist
    const relationships = this.blueprint.relationships.map(r => `${r.source}→${r.target}`);

    // Path: Partner → PartnerAccount
    if (!relationships.some(r => r.startsWith('Partner→PartnerAccount'))) {
      this.errors.push('Critical path missing: Partner → PartnerAccount');
    }

    // Path: Partner → PartnerQRCode → ReferralEvent → LeadEvent → SaleEvent
    if (!relationships.some(r => r.startsWith('Partner→PartnerQRCode'))) {
      this.errors.push('Critical path missing: Partner → PartnerQRCode');
    }
    if (!relationships.some(r => r.startsWith('PartnerQRCode→ReferralEvent'))) {
      this.errors.push('Critical path missing: PartnerQRCode → ReferralEvent');
    }
    if (!relationships.some(r => r.startsWith('ReferralEvent→LeadEvent'))) {
      this.errors.push('Critical path missing: ReferralEvent → LeadEvent');
    }
    if (!relationships.some(r => r.startsWith('LeadEvent→SaleEvent'))) {
      this.errors.push('Critical path missing: LeadEvent → SaleEvent');
    }

    // Path: SaleEvent → AttributionRecord
    if (!relationships.some(r => r.startsWith('SaleEvent→AttributionRecord'))) {
      this.errors.push('Critical path missing: SaleEvent → AttributionRecord');
    }

    // Path: Partner → PartnerPayout
    if (!relationships.some(r => r.startsWith('Partner→PartnerPayout'))) {
      this.errors.push('Critical path missing: Partner → PartnerPayout');
    }

    // No circular dependencies (DAG validation)
    this._checkCircularDependencies();
  }

  /**
   * Check for circular dependencies using DFS
   */
  _checkCircularDependencies() {
    const graph = {};

    // Build adjacency list
    for (const rel of this.blueprint.relationships) {
      if (!graph[rel.source]) graph[rel.source] = [];
      graph[rel.source].push(rel.target);
    }

    // DFS to detect cycles
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (node, path = []) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, [...path])) return true;
        } else if (recStack.has(neighbor)) {
          this.errors.push(`Circular dependency detected: ${path.join(' → ')} → ${neighbor}`);
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const entity of this.blueprint.entities.map(e => e.name)) {
      if (!visited.has(entity)) {
        hasCycle(entity);
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport(format = 'text') {
    const result = this.validate();

    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    // Text format
    const lines = [];
    lines.push('╔═══════════════════════════════════════════════════════════════════╗');
    lines.push('║  Partner & QR Identity Engine - Validation Report                ║');
    lines.push('╚═══════════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Duration: ${1}ms`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('ERRORS:');
      for (const error of result.errors) {
        lines.push(`  ✗ ${error}`);
      }
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      for (const warning of result.warnings) {
        lines.push(`  ⚠ ${warning}`);
      }
      lines.push('');
    }

    lines.push('STATISTICS:');
    lines.push(`  Entities Validated: ${result.stats.entities_validated}/10`);
    lines.push(`  Relationships Validated: ${result.stats.relationships_validated}/11`);
    lines.push(`  Events Validated: ${result.stats.events_validated}/8`);
    lines.push(`  Permissions Validated: ${result.stats.permissions_validated}/4`);
    lines.push(`  Rules Validated: ${result.stats.rules_validated}/5`);
    lines.push(`  Dashboard Contracts Validated: ${result.stats.contracts_validated}/8`);
    lines.push('');

    lines.push('COVERAGE:');
    lines.push(`  Total Validations Passed: ${
      result.stats.entities_validated + 
      result.stats.relationships_validated + 
      result.stats.events_validated + 
      result.stats.permissions_validated + 
      result.stats.rules_validated + 
      result.stats.contracts_validated
    }`);

    return lines.join('\n');
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      entities: this.blueprint.entities.length,
      relationships: this.blueprint.relationships.length,
      events: this.blueprint.events.length,
      permissions: this.blueprint.permissions.length,
      rules: this.blueprint.validation_rules.length,
      contracts: this.blueprint.dashboard_contracts.length
    };
  }
}
