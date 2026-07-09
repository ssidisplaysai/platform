/**
 * PartnerQRIdentityBlueprint.mjs
 *
 * Genesis Partner & QR Identity Engine v1
 * Metadata-driven partner, referral, QR identity, attribution, and commission tracking module
 *
 * @module tools/genesis/compiler/PartnerQRIdentityBlueprint.mjs
 */

import crypto from 'crypto';

/**
 * EntityDefinition - Defines structure for partner system entities
 * Describes an entity type with fields, permissions, and lifecycle
 */
export class EntityDefinition {
  constructor(config) {
    if (!config.name) throw new Error('EntityDefinition requires name');
    if (!config.entity_type) throw new Error('EntityDefinition requires entity_type');

    this.id = 'ent-' + crypto.randomBytes(8).toString('hex');
    this.name = config.name;
    this.entity_type = config.entity_type; // 'partner', 'qr_code', 'campaign', 'event', 'rule', 'analytics'
    this.description = config.description || '';
    this.version = config.version || '1.0.0';
    this.status_lifecycle = 'draft';
    this.fields = config.fields || []; // Array of {name, type, required, description}
    this.permissions = config.permissions || []; // Array of {role, actions}
    this.lifecycle_stages = config.lifecycle_stages || [];
    this.events_emitted = config.events_emitted || []; // Events this entity emits
    this.validations = config.validations || [];

    this._validateFields();
  }

  _validateFields() {
    if (this.fields && !Array.isArray(this.fields)) {
      throw new Error('EntityDefinition fields must be an array');
    }
    if (this.permissions && !Array.isArray(this.permissions)) {
      throw new Error('EntityDefinition permissions must be an array');
    }
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]) {
      throw new Error(`No valid transitions from ${this.status_lifecycle}`);
    }
    if (!validTransitions[this.status_lifecycle].includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      entity_type: this.entity_type,
      description: this.description,
      version: this.version,
      status_lifecycle: this.status_lifecycle,
      fields: this.fields,
      permissions: this.permissions,
      lifecycle_stages: this.lifecycle_stages,
      events_emitted: this.events_emitted,
      validations: this.validations
    };
  }
}

/**
 * RelationshipDefinition - Defines relationships between partner system entities
 */
export class RelationshipDefinition {
  constructor(config) {
    if (!config.source) throw new Error('RelationshipDefinition requires source');
    if (!config.target) throw new Error('RelationshipDefinition requires target');
    if (!config.type) throw new Error('RelationshipDefinition requires type');

    this.id = 'rel-' + crypto.randomBytes(8).toString('hex');
    this.source = config.source; // Entity name
    this.target = config.target;
    this.type = config.type; // 'owns', 'generates', 'tracks', 'attributes', 'earns', 'pays'
    this.cardinality = config.cardinality || '1:N'; // 1:1, 1:N, N:N
    this.required = config.required !== false;
    this.description = config.description || '';
    this.status_lifecycle = 'draft';

    this._validate();
  }

  _validate() {
    const validTypes = [
      'owns', 'generates', 'tracks', 'attributes', 'earns', 'pays',
      'references', 'inherits', 'integrates', 'depends_on', 'contains',
      'applies_to'
    ];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid relationship type: ${this.type}`);
    }
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      cardinality: this.cardinality,
      required: this.required,
      description: this.description,
      status_lifecycle: this.status_lifecycle
    };
  }
}

/**
 * EventDefinition - Defines events in the partner system
 */
export class EventDefinition {
  constructor(config) {
    if (!config.name) throw new Error('EventDefinition requires name');
    if (!config.aggregate) throw new Error('EventDefinition requires aggregate');

    this.id = 'evt-' + crypto.randomBytes(8).toString('hex');
    this.name = config.name;
    this.aggregate = config.aggregate; // Partner, QRCode, Campaign, ReferralEvent, etc.
    this.description = config.description || '';
    this.payload = config.payload || []; // Fields in event payload
    this.status_lifecycle = 'draft';

    this._validate();
  }

  _validate() {
    if (!Array.isArray(this.payload)) {
      throw new Error('EventDefinition payload must be an array');
    }
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      aggregate: this.aggregate,
      description: this.description,
      payload: this.payload,
      status_lifecycle: this.status_lifecycle
    };
  }
}

/**
 * DashboardContractDefinition - Defines dashboard metrics and visualizations
 */
export class DashboardContractDefinition {
  constructor(config) {
    if (!config.name) throw new Error('DashboardContractDefinition requires name');
    if (!config.contract_type) throw new Error('DashboardContractDefinition requires contract_type');

    this.id = 'dash-' + crypto.randomBytes(8).toString('hex');
    this.name = config.name;
    this.contract_type = config.contract_type; // metric, chart, table, summary
    this.description = config.description || '';
    this.source_entities = config.source_entities || [];
    this.aggregations = config.aggregations || []; // sum, count, avg, max, etc.
    this.filters = config.filters || [];
    this.visualizations = config.visualizations || [];
    this.refresh_interval = config.refresh_interval || 'realtime'; // realtime, 5min, 1hr, 1day
    this.status_lifecycle = 'draft';
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      contract_type: this.contract_type,
      description: this.description,
      source_entities: this.source_entities,
      aggregations: this.aggregations,
      filters: this.filters,
      visualizations: this.visualizations,
      refresh_interval: this.refresh_interval,
      status_lifecycle: this.status_lifecycle
    };
  }
}

/**
 * PermissionDefinition - Defines role-based permissions
 */
export class PermissionDefinition {
  constructor(config) {
    if (!config.role) throw new Error('PermissionDefinition requires role');
    if (!config.actions) throw new Error('PermissionDefinition requires actions');

    this.id = 'perm-' + crypto.randomBytes(8).toString('hex');
    this.role = config.role; // admin, manager, partner, viewer
    this.actions = config.actions; // Array of actions
    this.entities = config.entities || []; // Entities this role can access
    this.status_lifecycle = 'draft';

    this._validate();
  }

  _validate() {
    const validRoles = ['admin', 'manager', 'partner', 'viewer', 'guest'];
    if (!validRoles.includes(this.role)) {
      throw new Error(`Invalid role: ${this.role}`);
    }
    if (!Array.isArray(this.actions)) {
      throw new Error('PermissionDefinition actions must be an array');
    }
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      actions: this.actions,
      entities: this.entities,
      status_lifecycle: this.status_lifecycle
    };
  }
}

/**
 * ValidationRuleDefinition - Defines business validation rules
 */
export class ValidationRuleDefinition {
  constructor(config) {
    if (!config.name) throw new Error('ValidationRuleDefinition requires name');
    if (!config.rule) throw new Error('ValidationRuleDefinition requires rule');

    this.id = 'vrule-' + crypto.randomBytes(8).toString('hex');
    this.name = config.name;
    this.rule = config.rule; // Validation logic description
    this.severity = config.severity || 'error'; // error, warning
    this.applies_to = config.applies_to || []; // Entities this rule applies to
    this.auto_fixable = config.auto_fixable !== false;
    this.status_lifecycle = 'draft';
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'draft'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      rule: this.rule,
      severity: this.severity,
      applies_to: this.applies_to,
      auto_fixable: this.auto_fixable,
      status_lifecycle: this.status_lifecycle
    };
  }
}

/**
 * PartnerQRIdentityBlueprint - Master contract for partner & QR identity system
 */
export class PartnerQRIdentityBlueprint {
  constructor(config = {}) {
    this.id = 'pq-blueprint-' + crypto.randomBytes(8).toString('hex');
    this.name = config.name || 'Genesis Partner & QR Identity Engine v1';
    this.version = config.version || '1.0.0';
    this.description = config.description || 'Metadata-driven partner, referral, QR identity, attribution, and commission tracking module';
    this.status_lifecycle = 'draft';
    this.entities = config.entities || [];
    this.relationships = config.relationships || [];
    this.events = config.events || [];
    this.permissions = config.permissions || [];
    this.validation_rules = config.validation_rules || [];
    this.dashboard_contracts = config.dashboard_contracts || [];
  }

  transition(newStatus) {
    const validTransitions = {
      draft: ['defined', 'validated', 'approved'],
      defined: ['validated', 'approved'],
      validated: ['approved', 'defined'],
      approved: ['deprecated'],
      deprecated: ['archived']
    };

    if (!validTransitions[this.status_lifecycle]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${this.status_lifecycle} to ${newStatus}`
      );
    }

    this.status_lifecycle = newStatus;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      status_lifecycle: this.status_lifecycle,
      entities: this.entities.map(e => e.toJSON?.() || e),
      relationships: this.relationships.map(r => r.toJSON?.() || r),
      events: this.events.map(e => e.toJSON?.() || e),
      permissions: this.permissions.map(p => p.toJSON?.() || p),
      validation_rules: this.validation_rules.map(r => r.toJSON?.() || r),
      dashboard_contracts: this.dashboard_contracts.map(d => d.toJSON?.() || d)
    };
  }
}

/**
 * createPartnerQRIdentityBlueprint - Factory function creating complete Partner & QR Identity Engine metadata
 */
export function createPartnerQRIdentityBlueprint() {
  const blueprint = new PartnerQRIdentityBlueprint();

  // ========== Core Entities ==========

  // Partner - Core partner entity
  blueprint.entities.push(new EntityDefinition({
    name: 'Partner',
    entity_type: 'partner',
    description: 'Partner in the Genesis ecosystem',
    fields: [
      { name: 'partner_id', type: 'string', required: true, description: 'Unique partner identifier' },
      { name: 'company_id', type: 'string', required: true, description: 'Company the partner belongs to' },
      { name: 'name', type: 'string', required: true, description: 'Partner name' },
      { name: 'email', type: 'string', required: true, description: 'Partner email' },
      { name: 'phone', type: 'string', required: false, description: 'Partner phone' },
      { name: 'status', type: 'enum', required: true, description: 'onboarding, active, suspended, inactive' },
      { name: 'tier', type: 'string', required: false, description: 'Partner tier level' },
      { name: 'created_at', type: 'timestamp', required: true, description: 'Account creation date' },
      { name: 'metadata', type: 'object', required: false, description: 'Custom partner metadata' }
    ],
    lifecycle_stages: ['onboarding', 'active', 'suspended', 'inactive'],
    events_emitted: ['partner.created']
  }));

  // PartnerAccount - Financial account for partner
  blueprint.entities.push(new EntityDefinition({
    name: 'PartnerAccount',
    entity_type: 'partner',
    description: 'Financial account associated with a partner',
    fields: [
      { name: 'account_id', type: 'string', required: true, description: 'Unique account identifier' },
      { name: 'partner_id', type: 'string', required: true, description: 'Associated partner' },
      { name: 'balance', type: 'decimal', required: true, description: 'Current account balance' },
      { name: 'currency', type: 'string', required: true, description: 'Account currency' },
      { name: 'status', type: 'enum', required: true, description: 'active, suspended, closed' },
      { name: 'verified_at', type: 'timestamp', required: false, description: 'Verification timestamp' },
      { name: 'payout_method', type: 'object', required: false, description: 'Payout method details' }
    ],
    lifecycle_stages: ['pending', 'verified', 'active', 'suspended', 'closed'],
    events_emitted: []
  }));

  // PartnerQRCode - QR code for partner tracking
  blueprint.entities.push(new EntityDefinition({
    name: 'PartnerQRCode',
    entity_type: 'qr_code',
    description: 'QR code for partner referral and tracking',
    fields: [
      { name: 'qr_id', type: 'string', required: true, description: 'Unique QR code identifier' },
      { name: 'partner_id', type: 'string', required: true, description: 'Partner that owns the QR' },
      { name: 'campaign_id', type: 'string', required: false, description: 'Associated campaign' },
      { name: 'qr_code', type: 'string', required: true, description: 'Encoded QR data' },
      { name: 'url', type: 'string', required: true, description: 'QR target URL' },
      { name: 'status', type: 'enum', required: true, description: 'active, inactive, expired' },
      { name: 'generated_at', type: 'timestamp', required: true, description: 'QR generation timestamp' },
      { name: 'expires_at', type: 'timestamp', required: false, description: 'QR expiration timestamp' }
    ],
    lifecycle_stages: ['generated', 'active', 'inactive', 'expired'],
    events_emitted: ['qr.generated', 'qr.scanned']
  }));

  // Campaign - Marketing campaign definition
  blueprint.entities.push(new EntityDefinition({
    name: 'Campaign',
    entity_type: 'campaign',
    description: 'Marketing campaign for partner referral tracking',
    fields: [
      { name: 'campaign_id', type: 'string', required: true, description: 'Unique campaign identifier' },
      { name: 'partner_id', type: 'string', required: false, description: 'Partner running campaign' },
      { name: 'company_id', type: 'string', required: true, description: 'Company the campaign belongs to' },
      { name: 'name', type: 'string', required: true, description: 'Campaign name' },
      { name: 'description', type: 'string', required: false, description: 'Campaign description' },
      { name: 'status', type: 'enum', required: true, description: 'draft, active, paused, completed' },
      { name: 'start_date', type: 'timestamp', required: true, description: 'Campaign start date' },
      { name: 'end_date', type: 'timestamp', required: false, description: 'Campaign end date' },
      { name: 'type', type: 'enum', required: true, description: 'referral, affiliate, promo, viral' }
    ],
    lifecycle_stages: ['draft', 'active', 'paused', 'completed', 'archived'],
    events_emitted: []
  }));

  // ReferralEvent - Referral event from QR scan or link click
  blueprint.entities.push(new EntityDefinition({
    name: 'ReferralEvent',
    entity_type: 'event',
    description: 'Referral event from QR scan or referral link click',
    fields: [
      { name: 'event_id', type: 'string', required: true, description: 'Unique event identifier' },
      { name: 'qr_id', type: 'string', required: false, description: 'QR code if scanned' },
      { name: 'partner_id', type: 'string', required: true, description: 'Partner being credited' },
      { name: 'campaign_id', type: 'string', required: false, description: 'Associated campaign' },
      { name: 'event_type', type: 'enum', required: true, description: 'scan, click, lead_open' },
      { name: 'user_agent', type: 'string', required: false, description: 'User agent string' },
      { name: 'ip_address', type: 'string', required: false, description: 'User IP address' },
      { name: 'occurred_at', type: 'timestamp', required: true, description: 'Event timestamp' }
    ],
    lifecycle_stages: ['captured', 'processed', 'attributed'],
    events_emitted: ['qr.scanned']
  }));

  // LeadEvent - Lead conversion from referral
  blueprint.entities.push(new EntityDefinition({
    name: 'LeadEvent',
    entity_type: 'event',
    description: 'Lead event generated from referral',
    fields: [
      { name: 'lead_id', type: 'string', required: true, description: 'Unique lead identifier' },
      { name: 'partner_id', type: 'string', required: true, description: 'Partner who referred' },
      { name: 'referral_event_id', type: 'string', required: true, description: 'Source referral event' },
      { name: 'lead_email', type: 'string', required: true, description: 'Lead email address' },
      { name: 'lead_name', type: 'string', required: false, description: 'Lead name' },
      { name: 'source', type: 'string', required: true, description: 'Lead source' },
      { name: 'value', type: 'decimal', required: false, description: 'Estimated lead value' },
      { name: 'created_at', type: 'timestamp', required: true, description: 'Lead creation timestamp' }
    ],
    lifecycle_stages: ['captured', 'qualified', 'unqualified', 'converted'],
    events_emitted: ['lead.created']
  }));

  // SaleEvent - Sale attribution to partner
  blueprint.entities.push(new EntityDefinition({
    name: 'SaleEvent',
    entity_type: 'event',
    description: 'Sale event attributed to partner referral',
    fields: [
      { name: 'sale_id', type: 'string', required: true, description: 'Unique sale identifier' },
      { name: 'partner_id', type: 'string', required: true, description: 'Partner who generated sale' },
      { name: 'lead_id', type: 'string', required: true, description: 'Lead that converted' },
      { name: 'amount', type: 'decimal', required: true, description: 'Sale amount' },
      { name: 'currency', type: 'string', required: true, description: 'Sale currency' },
      { name: 'product_id', type: 'string', required: false, description: 'Product sold' },
      { name: 'status', type: 'enum', required: true, description: 'pending, confirmed, disputed, refunded' },
      { name: 'occurred_at', type: 'timestamp', required: true, description: 'Sale timestamp' }
    ],
    lifecycle_stages: ['pending', 'confirmed', 'disputed', 'refunded'],
    events_emitted: ['sale.attributed']
  }));

  // AttributionRecord - Attribution calculation result
  blueprint.entities.push(new EntityDefinition({
    name: 'AttributionRecord',
    entity_type: 'rule',
    description: 'Attribution record linking sales to partners',
    fields: [
      { name: 'attribution_id', type: 'string', required: true, description: 'Unique attribution identifier' },
      { name: 'sale_id', type: 'string', required: true, description: 'Attributed sale' },
      { name: 'partner_id', type: 'string', required: true, description: 'Attributed partner' },
      { name: 'attribution_rule_id', type: 'string', required: true, description: 'Applied rule' },
      { name: 'attribution_percentage', type: 'decimal', required: true, description: 'Attribution percentage' },
      { name: 'attributed_amount', type: 'decimal', required: true, description: 'Amount attributed' },
      { name: 'confidence_score', type: 'decimal', required: false, description: 'Attribution confidence 0-1' },
      { name: 'created_at', type: 'timestamp', required: true, description: 'Attribution timestamp' }
    ],
    lifecycle_stages: ['created', 'confirmed', 'disputed'],
    events_emitted: []
  }));

  // CommissionRule - Commission calculation rule
  blueprint.entities.push(new EntityDefinition({
    name: 'CommissionRule',
    entity_type: 'rule',
    description: 'Commission calculation rule for partners',
    fields: [
      { name: 'rule_id', type: 'string', required: true, description: 'Unique rule identifier' },
      { name: 'company_id', type: 'string', required: true, description: 'Company this rule applies to' },
      { name: 'rule_name', type: 'string', required: true, description: 'Rule name' },
      { name: 'partner_tier', type: 'string', required: false, description: 'Partner tier for this rule' },
      { name: 'commission_rate', type: 'decimal', required: true, description: 'Commission rate percentage' },
      { name: 'minimum_sale_amount', type: 'decimal', required: false, description: 'Minimum sale for commission' },
      { name: 'status', type: 'enum', required: true, description: 'draft, active, deprecated' },
      { name: 'created_at', type: 'timestamp', required: true, description: 'Rule creation timestamp' }
    ],
    lifecycle_stages: ['draft', 'active', 'deprecated'],
    events_emitted: []
  }));

  // PartnerPayout - Payout record for partner
  blueprint.entities.push(new EntityDefinition({
    name: 'PartnerPayout',
    entity_type: 'partner',
    description: 'Payout record for partner commissions',
    fields: [
      { name: 'payout_id', type: 'string', required: true, description: 'Unique payout identifier' },
      { name: 'partner_id', type: 'string', required: true, description: 'Partner receiving payout' },
      { name: 'period_start', type: 'timestamp', required: true, description: 'Payout period start' },
      { name: 'period_end', type: 'timestamp', required: true, description: 'Payout period end' },
      { name: 'total_amount', type: 'decimal', required: true, description: 'Total payout amount' },
      { name: 'currency', type: 'string', required: true, description: 'Payout currency' },
      { name: 'status', type: 'enum', required: true, description: 'pending, approved, paid, disputed' },
      { name: 'payout_method', type: 'string', required: true, description: 'How payout will be made' }
    ],
    lifecycle_stages: ['pending', 'approved', 'paid', 'disputed', 'disputed_resolved'],
    events_emitted: ['payout.created', 'payout.paid']
  }));

  // ========== Relationships ==========

  // Partner owns PartnerAccount
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'Partner',
    target: 'PartnerAccount',
    type: 'owns',
    cardinality: '1:N',
    description: 'A partner owns one or more financial accounts'
  }));

  // Partner generates PartnerQRCode
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'Partner',
    target: 'PartnerQRCode',
    type: 'generates',
    cardinality: '1:N',
    description: 'A partner can generate multiple QR codes'
  }));

  // Partner runs Campaign
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'Partner',
    target: 'Campaign',
    type: 'owns',
    cardinality: '1:N',
    description: 'A partner can run multiple campaigns'
  }));

  // Campaign contains PartnerQRCode
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'Campaign',
    target: 'PartnerQRCode',
    type: 'contains',
    cardinality: '1:N',
    description: 'A campaign can have multiple QR codes'
  }));

  // PartnerQRCode generates ReferralEvent
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'PartnerQRCode',
    target: 'ReferralEvent',
    type: 'generates',
    cardinality: '1:N',
    description: 'A QR code generates referral events when scanned'
  }));

  // ReferralEvent generates LeadEvent
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'ReferralEvent',
    target: 'LeadEvent',
    type: 'generates',
    cardinality: '1:1',
    description: 'A referral event can generate a lead'
  }));

  // LeadEvent generates SaleEvent
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'LeadEvent',
    target: 'SaleEvent',
    type: 'generates',
    cardinality: '1:N',
    description: 'A lead can generate multiple sales'
  }));

  // SaleEvent generates AttributionRecord
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'SaleEvent',
    target: 'AttributionRecord',
    type: 'generates',
    cardinality: '1:N',
    description: 'A sale can have multiple attribution records'
  }));

  // CommissionRule applies to Partner
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'CommissionRule',
    target: 'Partner',
    type: 'applies_to',
    cardinality: 'N:N',
    description: 'Commission rules apply to partners'
  }));

  // Partner earns PartnerPayout
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'Partner',
    target: 'PartnerPayout',
    type: 'earns',
    cardinality: '1:N',
    description: 'A partner receives multiple payouts'
  }));

  // AttributionRecord determines PartnerPayout
  blueprint.relationships.push(new RelationshipDefinition({
    source: 'AttributionRecord',
    target: 'PartnerPayout',
    type: 'attributes',
    cardinality: 'N:1',
    description: 'Attribution records contribute to payouts'
  }));

  // ========== Events ==========

  blueprint.events.push(new EventDefinition({
    name: 'partner.created',
    aggregate: 'Partner',
    description: 'Emitted when a new partner is created',
    payload: [
      { name: 'partner_id', type: 'string' },
      { name: 'company_id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'created_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'qr.generated',
    aggregate: 'PartnerQRCode',
    description: 'Emitted when a QR code is generated',
    payload: [
      { name: 'qr_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'url', type: 'string' },
      { name: 'generated_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'qr.scanned',
    aggregate: 'ReferralEvent',
    description: 'Emitted when a QR code is scanned',
    payload: [
      { name: 'event_id', type: 'string' },
      { name: 'qr_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'occurred_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'lead.created',
    aggregate: 'LeadEvent',
    description: 'Emitted when a lead is created from a referral',
    payload: [
      { name: 'lead_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'lead_email', type: 'string' },
      { name: 'created_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'sale.attributed',
    aggregate: 'SaleEvent',
    description: 'Emitted when a sale is attributed to a partner',
    payload: [
      { name: 'sale_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'amount', type: 'decimal' },
      { name: 'occurred_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'commission.earned',
    aggregate: 'CommissionRule',
    description: 'Emitted when a partner earns a commission',
    payload: [
      { name: 'commission_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'amount', type: 'decimal' },
      { name: 'rule_id', type: 'string' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'payout.created',
    aggregate: 'PartnerPayout',
    description: 'Emitted when a payout is created',
    payload: [
      { name: 'payout_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'total_amount', type: 'decimal' },
      { name: 'created_at', type: 'timestamp' }
    ]
  }));

  blueprint.events.push(new EventDefinition({
    name: 'payout.paid',
    aggregate: 'PartnerPayout',
    description: 'Emitted when a payout is completed',
    payload: [
      { name: 'payout_id', type: 'string' },
      { name: 'partner_id', type: 'string' },
      { name: 'total_amount', type: 'decimal' },
      { name: 'paid_at', type: 'timestamp' }
    ]
  }));

  // ========== Permissions ==========

  blueprint.permissions.push(new PermissionDefinition({
    role: 'admin',
    actions: ['create', 'read', 'update', 'delete', 'approve', 'verify', 'dispute'],
    entities: ['Partner', 'PartnerAccount', 'PartnerQRCode', 'Campaign', 'CommissionRule', 'PartnerPayout']
  }));

  blueprint.permissions.push(new PermissionDefinition({
    role: 'manager',
    actions: ['create', 'read', 'update', 'approve', 'verify'],
    entities: ['Partner', 'PartnerQRCode', 'Campaign', 'CommissionRule', 'PartnerPayout']
  }));

  blueprint.permissions.push(new PermissionDefinition({
    role: 'partner',
    actions: ['read', 'create'],
    entities: ['PartnerQRCode', 'Campaign', 'PartnerAccount']
  }));

  blueprint.permissions.push(new PermissionDefinition({
    role: 'viewer',
    actions: ['read'],
    entities: ['Partner', 'Campaign', 'PartnerPayout']
  }));

  // ========== Validation Rules ==========

  blueprint.validation_rules.push(new ValidationRuleDefinition({
    name: 'Partner email unique per company',
    rule: 'Partner email must be unique within company',
    severity: 'error',
    applies_to: ['Partner']
  }));

  blueprint.validation_rules.push(new ValidationRuleDefinition({
    name: 'Commission rate must be 0-100%',
    rule: 'Commission rate must be between 0 and 100',
    severity: 'error',
    applies_to: ['CommissionRule']
  }));

  blueprint.validation_rules.push(new ValidationRuleDefinition({
    name: 'Sale amount must be positive',
    rule: 'Sale amounts must be greater than 0',
    severity: 'error',
    applies_to: ['SaleEvent']
  }));

  blueprint.validation_rules.push(new ValidationRuleDefinition({
    name: 'Payout period must have start and end',
    rule: 'Period end must be after period start',
    severity: 'error',
    applies_to: ['PartnerPayout']
  }));

  blueprint.validation_rules.push(new ValidationRuleDefinition({
    name: 'Attribution percentage sum valid',
    rule: 'Total attribution percentages should not exceed 100%',
    severity: 'warning',
    applies_to: ['AttributionRecord']
  }));

  // ========== Dashboard Contracts ==========

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Total Scans',
    contract_type: 'metric',
    description: 'Total QR code scans in period',
    source_entities: ['ReferralEvent'],
    aggregations: ['count'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'campaign_id', type: 'string' }
    ],
    visualizations: ['number', 'sparkline'],
    refresh_interval: 'realtime'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Total Leads',
    contract_type: 'metric',
    description: 'Total leads generated from referrals',
    source_entities: ['LeadEvent'],
    aggregations: ['count'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'status', type: 'enum' }
    ],
    visualizations: ['number', 'sparkline'],
    refresh_interval: 'realtime'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Attributed Sales',
    contract_type: 'metric',
    description: 'Total sales attributed to partners',
    source_entities: ['SaleEvent', 'AttributionRecord'],
    aggregations: ['sum'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'status', type: 'enum' }
    ],
    visualizations: ['number', 'gauge', 'sparkline'],
    refresh_interval: '5min'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Commissions Owed',
    contract_type: 'metric',
    description: 'Total commissions owed to partners',
    source_entities: ['PartnerPayout', 'AttributionRecord'],
    aggregations: ['sum'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'status', type: 'enum' }
    ],
    visualizations: ['number', 'gauge'],
    refresh_interval: '1hr'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Top Partners',
    contract_type: 'table',
    description: 'Top performing partners by sales',
    source_entities: ['Partner', 'SaleEvent', 'AttributionRecord'],
    aggregations: ['sum', 'count', 'rank'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'limit', type: 'integer' }
    ],
    visualizations: ['table', 'bar_chart'],
    refresh_interval: '1hr'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Top Campaigns',
    contract_type: 'table',
    description: 'Top performing campaigns by engagement',
    source_entities: ['Campaign', 'PartnerQRCode', 'ReferralEvent'],
    aggregations: ['count', 'rank'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'limit', type: 'integer' }
    ],
    visualizations: ['table', 'bar_chart'],
    refresh_interval: '1hr'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Conversion Funnel',
    contract_type: 'chart',
    description: 'Conversion flow from scan to sale',
    source_entities: ['ReferralEvent', 'LeadEvent', 'SaleEvent'],
    aggregations: ['count'],
    filters: [
      { name: 'date_range', type: 'timestamp_range' },
      { name: 'partner_id', type: 'string' },
      { name: 'campaign_id', type: 'string' }
    ],
    visualizations: ['funnel_chart', 'line_chart'],
    refresh_interval: '1hr'
  }));

  blueprint.dashboard_contracts.push(new DashboardContractDefinition({
    name: 'Partner Performance',
    contract_type: 'summary',
    description: 'Overall partner performance summary',
    source_entities: ['Partner', 'ReferralEvent', 'LeadEvent', 'SaleEvent'],
    aggregations: ['count', 'sum', 'avg'],
    filters: [
      { name: 'partner_id', type: 'string' },
      { name: 'date_range', type: 'timestamp_range' }
    ],
    visualizations: ['summary', 'card'],
    refresh_interval: 'realtime'
  }));

  return blueprint;
}
