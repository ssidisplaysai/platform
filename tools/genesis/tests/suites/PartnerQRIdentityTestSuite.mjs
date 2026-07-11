/**
 * PartnerQRIdentityTestSuite.mjs
 *
 * Test suite for Partner & QR Identity Engine v1
 * Comprehensive tests for blueprint, validation, and inspection
 *
 * @module tools/genesis/tests/suites/PartnerQRIdentityTestSuite.mjs
 */

import { TestSuite } from '../TestSuite.mjs';
import {
  EntityDefinition,
  RelationshipDefinition,
  EventDefinition,
  DashboardContractDefinition,
  PermissionDefinition,
  ValidationRuleDefinition,
  PartnerQRIdentityBlueprint,
  createPartnerQRIdentityBlueprint
} from '../../compiler/PartnerQRIdentityBlueprint.mjs';
import { PartnerQRIdentityValidator } from '../../compiler/PartnerQRIdentityValidator.mjs';
import { PartnerQRIdentityInspector } from '../../compiler/PartnerQRIdentityInspector.mjs';

export default async function createPartnerQRIdentityTestSuite() {
  const suite = new TestSuite('Partner & QR Identity Engine v1');

  // ========== Entity Definition Tests ==========

  suite.addTest('EntityDefinition contract validation', () => {
    const entity = new EntityDefinition({
      name: 'TestEntity',
      entity_type: 'partner',
      description: 'Test entity'
    });

    if (!entity.id.startsWith('ent-')) throw new Error('Entity ID should start with ent-');
    if (entity.name !== 'TestEntity') throw new Error('Entity name mismatch');
    if (entity.entity_type !== 'partner') throw new Error('Entity type mismatch');
    if (entity.status_lifecycle !== 'draft') throw new Error('Initial status should be draft');
  });

  suite.addTest('EntityDefinition requires name', () => {
    try {
      new EntityDefinition({ entity_type: 'partner' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'EntityDefinition requires name') throw e;
    }
  });

  suite.addTest('EntityDefinition requires entity_type', () => {
    try {
      new EntityDefinition({ name: 'Test' });
      throw new Error('Should have thrown');
    } catch (e) {
      if (e.message !== 'EntityDefinition requires entity_type') throw e;
    }
  });

  // ========== Relationship Definition Tests ==========

  suite.addTest('RelationshipDefinition contract validation', () => {
    const rel = new RelationshipDefinition({
      source: 'Partner',
      target: 'PartnerAccount',
      type: 'owns'
    });

    if (!rel.id.startsWith('rel-')) throw new Error('Relationship ID should start with rel-');
    if (rel.source !== 'Partner') throw new Error('Source mismatch');
    if (rel.target !== 'PartnerAccount') throw new Error('Target mismatch');
    if (rel.type !== 'owns') throw new Error('Type mismatch');
  });

  suite.addTest('RelationshipDefinition validates relationship type', () => {
    try {
      new RelationshipDefinition({
        source: 'Partner',
        target: 'PartnerAccount',
        type: 'invalid_type'
      });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid relationship type')) throw e;
    }
  });

  // ========== Event Definition Tests ==========

  suite.addTest('EventDefinition contract validation', () => {
    const event = new EventDefinition({
      name: 'partner.created',
      aggregate: 'Partner',
      description: 'Partner created event',
      payload: [
        { name: 'partner_id', type: 'string' },
        { name: 'created_at', type: 'timestamp' }
      ]
    });

    if (!event.id.startsWith('evt-')) throw new Error('Event ID should start with evt-');
    if (event.name !== 'partner.created') throw new Error('Event name mismatch');
    if (event.aggregate !== 'Partner') throw new Error('Aggregate mismatch');
    if (event.payload.length !== 2) throw new Error('Payload length mismatch');
  });

  // ========== Permission Definition Tests ==========

  suite.addTest('PermissionDefinition contract validation', () => {
    const perm = new PermissionDefinition({
      role: 'admin',
      actions: ['read', 'write', 'delete'],
      entities: ['Partner', 'PartnerAccount']
    });

    if (!perm.id.startsWith('perm-')) throw new Error('Permission ID should start with perm-');
    if (perm.role !== 'admin') throw new Error('Role mismatch');
    if (perm.actions.length !== 3) throw new Error('Actions length mismatch');
  });

  suite.addTest('PermissionDefinition validates role', () => {
    try {
      new PermissionDefinition({
        role: 'invalid_role',
        actions: ['read']
      });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('Invalid role')) throw e;
    }
  });

  // ========== Dashboard Contract Tests ==========

  suite.addTest('DashboardContractDefinition contract validation', () => {
    const contract = new DashboardContractDefinition({
      name: 'Total Scans',
      contract_type: 'metric',
      description: 'Total QR scans',
      source_entities: ['ReferralEvent'],
      aggregations: ['count']
    });

    if (!contract.id.startsWith('dash-')) throw new Error('Contract ID should start with dash-');
    if (contract.name !== 'Total Scans') throw new Error('Name mismatch');
    if (contract.contract_type !== 'metric') throw new Error('Type mismatch');
  });

  // ========== Validation Rule Tests ==========

  suite.addTest('ValidationRuleDefinition contract validation', () => {
    const rule = new ValidationRuleDefinition({
      name: 'Commission rate valid',
      rule: 'Commission rate must be 0-100%',
      severity: 'error',
      applies_to: ['CommissionRule']
    });

    if (!rule.id.startsWith('vrule-')) throw new Error('Rule ID should start with vrule-');
    if (rule.name !== 'Commission rate valid') throw new Error('Name mismatch');
  });

  // ========== Blueprint Status Lifecycle Tests ==========

  suite.addTest('Entity status lifecycle transitions', () => {
    const entity = new EntityDefinition({
      name: 'Test',
      entity_type: 'partner'
    });

    if (entity.status_lifecycle !== 'draft') throw new Error('Initial status should be draft');
    
    entity.transition('defined');
    if (entity.status_lifecycle !== 'defined') throw new Error('Should transition to defined');
    
    entity.transition('validated');
    if (entity.status_lifecycle !== 'validated') throw new Error('Should transition to validated');
    
    entity.transition('approved');
    if (entity.status_lifecycle !== 'approved') throw new Error('Should transition to approved');
  });

  suite.addTest('Relationship status lifecycle transitions', () => {
    const rel = new RelationshipDefinition({
      source: 'Partner',
      target: 'PartnerAccount',
      type: 'owns'
    });

    rel.transition('defined');
    rel.transition('validated');
    rel.transition('approved');
    if (rel.status_lifecycle !== 'approved') throw new Error('Should transition to approved');
  });

  // ========== Serialization Tests ==========

  suite.addTest('Entity serialization to JSON', () => {
    const entity = new EntityDefinition({
      name: 'Partner',
      entity_type: 'partner',
      fields: [{ name: 'id', type: 'string', required: true }]
    });

    const json = entity.toJSON();
    if (!json.id) throw new Error('JSON should have id');
    if (json.name !== 'Partner') throw new Error('JSON name mismatch');
    if (!Array.isArray(json.fields)) throw new Error('JSON fields should be array');
  });

  suite.addTest('Blueprint population and serialization', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    
    if (blueprint.entities.length === 0) throw new Error('Blueprint should have entities');
    if (blueprint.relationships.length === 0) throw new Error('Blueprint should have relationships');
    if (blueprint.events.length === 0) throw new Error('Blueprint should have events');

    const json = blueprint.toJSON();
    if (!Array.isArray(json.entities)) throw new Error('JSON entities should be array');
    if (!Array.isArray(json.relationships)) throw new Error('JSON relationships should be array');
  });

  // ========== Validator Tests ==========

  suite.addTest('PartnerQRIdentityValidator initializes', () => {
    const validator = new PartnerQRIdentityValidator();
    if (!validator.blueprint) throw new Error('Validator should have blueprint');
  });

  suite.addTest('Validator checks for required entities', () => {
    const validator = new PartnerQRIdentityValidator();
    const result = validator.validate();
    
    if (result.errors.length > 0) {
      throw new Error(`Validation should pass: ${result.errors[0]}`);
    }
  });

  suite.addTest('Validator validates entity definitions', () => {
    const validator = new PartnerQRIdentityValidator();
    const result = validator.validate();
    
    if (result.stats.entities_validated === 0) throw new Error('Should validate entities');
  });

  suite.addTest('Validator validates relationships', () => {
    const validator = new PartnerQRIdentityValidator();
    const result = validator.validate();
    
    if (result.stats.relationships_validated === 0) throw new Error('Should validate relationships');
  });

  suite.addTest('Validator validates critical paths', () => {
    const validator = new PartnerQRIdentityValidator();
    const result = validator.validate();
    
    // Should have no errors for critical paths
    const criticalPathErrors = result.errors.filter(e => e.includes('Critical path'));
    if (criticalPathErrors.length > 0) {
      throw new Error(`Critical path errors: ${criticalPathErrors[0]}`);
    }
  });

  suite.addTest('Validator generates text report', () => {
    const validator = new PartnerQRIdentityValidator();
    const report = validator.generateReport('text');
    
    if (!report.includes('VALID')) throw new Error('Report should show validation status');
    if (!report.includes('Entities Validated')) throw new Error('Report should show statistics');
  });

  suite.addTest('Validator generates JSON report', () => {
    const validator = new PartnerQRIdentityValidator();
    const json = validator.generateReport('json');
    const parsed = JSON.parse(json);
    
    if (typeof parsed.valid !== 'boolean') throw new Error('JSON should have valid status');
    if (!parsed.stats) throw new Error('JSON should have stats');
  });

  // ========== Inspector Tests ==========

  suite.addTest('PartnerQRIdentityInspector initializes', () => {
    const inspector = new PartnerQRIdentityInspector();
    if (!inspector.blueprint) throw new Error('Inspector should have blueprint');
  });

  suite.addTest('Inspector inspects architecture', () => {
    const inspector = new PartnerQRIdentityInspector();
    const inspection = inspector.inspectArchitecture();
    
    if (!inspection.timestamp) throw new Error('Should have timestamp');
    if (!inspection.health_status) throw new Error('Should have health_status');
    if (typeof inspection.health_percentage !== 'number') throw new Error('Should have health_percentage');
  });

  suite.addTest('Inspector calculates metrics', () => {
    const inspector = new PartnerQRIdentityInspector();
    const inspection = inspector.inspectArchitecture();
    
    if (inspection.metrics.entity_count === 0) throw new Error('Should count entities');
    if (inspection.metrics.relationship_count === 0) throw new Error('Should count relationships');
    if (inspection.metrics.event_count === 0) throw new Error('Should count events');
  });

  suite.addTest('Inspector determines health status', () => {
    const inspector = new PartnerQRIdentityInspector();
    const inspection = inspector.inspectArchitecture();
    
    const validStatuses = ['HEALTHY', 'DEGRADED', 'WARNING', 'CRITICAL'];
    if (!validStatuses.includes(inspection.health_status)) {
      throw new Error(`Invalid health status: ${inspection.health_status}`);
    }
  });

  suite.addTest('Inspector generates recommendations', () => {
    const inspector = new PartnerQRIdentityInspector();
    const inspection = inspector.inspectArchitecture();
    
    if (!Array.isArray(inspection.recommendations)) throw new Error('Should have recommendations');
  });

  suite.addTest('Inspector inspects entity', () => {
    const inspector = new PartnerQRIdentityInspector();
    const entityInfo = inspector.inspectEntity('Partner');
    
    if (!entityInfo.name) throw new Error('Should return entity info');
    if (entityInfo.name !== 'Partner') throw new Error('Entity name mismatch');
    if (!Array.isArray(entityInfo.events_emitted)) throw new Error('Should have events_emitted');
  });

  suite.addTest('Inspector gets architecture layers', () => {
    const inspector = new PartnerQRIdentityInspector();
    const layers = inspector.getArchitectureLayers();
    
    if (!layers.entity_layer) throw new Error('Should have entity_layer');
    if (!layers.event_layer) throw new Error('Should have event_layer');
    if (!layers.permission_layer) throw new Error('Should have permission_layer');
  });

  suite.addTest('Inspector gets conversion funnel', () => {
    const inspector = new PartnerQRIdentityInspector();
    const funnel = inspector.getConversionFunnel();
    
    if (!funnel.funnel_path) throw new Error('Should have funnel_path');
    if (funnel.funnel_path.length === 0) throw new Error('Funnel path should have items');
    if (funnel.funnel_path[0] !== 'ReferralEvent') throw new Error('Should start with ReferralEvent');
  });

  suite.addTest('Inspector generates text report', () => {
    const inspector = new PartnerQRIdentityInspector();
    const report = inspector.generateReport('text');
    
    if (!report.includes('Health Status')) throw new Error('Report should show health status');
    if (!report.includes('METRICS')) throw new Error('Report should show metrics');
  });

  suite.addTest('Inspector generates JSON report', () => {
    const inspector = new PartnerQRIdentityInspector();
    const json = inspector.generateReport('json');
    const parsed = JSON.parse(json);
    
    if (!parsed.health_status) throw new Error('JSON should have health_status');
    if (!parsed.metrics) throw new Error('JSON should have metrics');
  });

  // ========== Integration Tests ==========

  suite.addTest('Blueprint has 10 core entities', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.entities.length !== 10) {
      throw new Error(`Expected 10 entities, got ${blueprint.entities.length}`);
    }
  });

  suite.addTest('Blueprint has 11 relationships', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.relationships.length !== 11) {
      throw new Error(`Expected 11 relationships, got ${blueprint.relationships.length}`);
    }
  });

  suite.addTest('Blueprint has 8 events', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.events.length !== 8) {
      throw new Error(`Expected 8 events, got ${blueprint.events.length}`);
    }
  });

  suite.addTest('Blueprint has 4 permissions', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.permissions.length !== 4) {
      throw new Error(`Expected 4 permissions, got ${blueprint.permissions.length}`);
    }
  });

  suite.addTest('Blueprint has 5 validation rules', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.validation_rules.length !== 5) {
      throw new Error(`Expected 5 rules, got ${blueprint.validation_rules.length}`);
    }
  });

  suite.addTest('Blueprint has 8 dashboard contracts', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    if (blueprint.dashboard_contracts.length !== 8) {
      throw new Error(`Expected 8 contracts, got ${blueprint.dashboard_contracts.length}`);
    }
  });

  suite.addTest('Full validation pipeline passes', () => {
    const validator = new PartnerQRIdentityValidator();
    const result = validator.validate();
    
    if (!result.valid) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }
  });

  suite.addTest('Full inspection pipeline executes', () => {
    const inspector = new PartnerQRIdentityInspector();
    const inspection = inspector.inspectArchitecture();
    
    if (!inspection.health_status) throw new Error('Inspection should complete');
  });

  suite.addTest('Partner entity has required fields', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    const partnerEntity = blueprint.entities.find(e => e.name === 'Partner');
    
    if (!partnerEntity) throw new Error('Partner entity not found');
    const fieldNames = (partnerEntity.fields || []).map(f => f.name);
    
    const required = ['partner_id', 'company_id', 'name', 'email', 'status'];
    for (const field of required) {
      if (!fieldNames.includes(field)) {
        throw new Error(`Partner missing field: ${field}`);
      }
    }
  });

  suite.addTest('QR tracking path exists', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    
    const hasQRToReferral = blueprint.relationships.some(
      r => r.source === 'PartnerQRCode' && r.target === 'ReferralEvent'
    );
    const hasReferralToLead = blueprint.relationships.some(
      r => r.source === 'ReferralEvent' && r.target === 'LeadEvent'
    );
    const hasLeadToSale = blueprint.relationships.some(
      r => r.source === 'LeadEvent' && r.target === 'SaleEvent'
    );

    if (!hasQRToReferral) throw new Error('QR → Referral path missing');
    if (!hasReferralToLead) throw new Error('Referral → Lead path missing');
    if (!hasLeadToSale) throw new Error('Lead → Sale path missing');
  });

  suite.addTest('Attribution and commission path exists', () => {
    const blueprint = createPartnerQRIdentityBlueprint();
    
    const hasSaleToAttribution = blueprint.relationships.some(
      r => r.source === 'SaleEvent' && r.target === 'AttributionRecord'
    );
    const hasPartnerToCommission = blueprint.relationships.some(
      r => r.source === 'CommissionRule' && r.target === 'Partner'
    );
    const hasPartnerToPayout = blueprint.relationships.some(
      r => r.source === 'Partner' && r.target === 'PartnerPayout'
    );

    if (!hasSaleToAttribution) throw new Error('Sale → Attribution path missing');
    if (!hasPartnerToCommission) throw new Error('CommissionRule → Partner path missing');
    if (!hasPartnerToPayout) throw new Error('Partner → Payout path missing');
  });

  return suite;
}
