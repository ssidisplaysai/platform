/**
 * PartnerQRIdentityInspector.mjs
 *
 * Inspects Partner & QR Identity Engine health and structure
 * Provides insights, metrics, and recommendations
 *
 * @module tools/genesis/compiler/PartnerQRIdentityInspector.mjs
 */

import { createPartnerQRIdentityBlueprint } from './PartnerQRIdentityBlueprint.mjs';

/**
 * PartnerQRIdentityInspector - Analyzes partner system health and structure
 */
export class PartnerQRIdentityInspector {
  constructor() {
    this.blueprint = createPartnerQRIdentityBlueprint();
  }

  /**
   * Inspect entire architecture
   */
  inspectArchitecture() {
    const timestamp = new Date().toISOString();

    const entityStatus = this._inspectEntities();
    const relationshipStatus = this._inspectRelationships();
    const eventStatus = this._inspectEvents();
    const metrics = this._calculateMetrics();
    const health = this._determineHealth(entityStatus, relationshipStatus, eventStatus);
    const recommendations = this._generateRecommendations(health, metrics);

    return {
      timestamp,
      health_status: health.status,
      health_percentage: health.percentage,
      entity_status: entityStatus,
      relationship_status: relationshipStatus,
      event_status: eventStatus,
      metrics,
      recommendations
    };
  }

  /**
   * Inspect entity health
   */
  _inspectEntities() {
    const status = {
      total: this.blueprint.entities.length,
      healthy: 0,
      warnings: 0,
      issues: []
    };

    for (const entity of this.blueprint.entities) {
      let entityHealth = 'healthy';

      // Check required attributes
      if (!entity.lifecycle_stages || entity.lifecycle_stages.length === 0) {
        status.issues.push(`${entity.name}: Missing lifecycle stages`);
        entityHealth = 'warning';
      }
      if (!entity.events_emitted || entity.events_emitted.length === 0) {
        status.issues.push(`${entity.name}: Not emitting events`);
        entityHealth = 'warning';
      }
      if (!entity.fields || entity.fields.length === 0) {
        status.issues.push(`${entity.name}: No fields defined`);
        entityHealth = 'warning';
      }

      if (entityHealth === 'healthy') {
        status.healthy++;
      } else {
        status.warnings++;
      }
    }

    return status;
  }

  /**
   * Inspect relationship health
   */
  _inspectRelationships() {
    const status = {
      total: this.blueprint.relationships.length,
      healthy: 0,
      warnings: 0,
      issues: []
    };

    for (const rel of this.blueprint.relationships) {
      let relHealth = 'healthy';

      if (!rel.cardinality) {
        status.issues.push(`${rel.source}→${rel.target}: Missing cardinality`);
        relHealth = 'warning';
      }
      if (!rel.type) {
        status.issues.push(`${rel.source}→${rel.target}: Missing relationship type`);
        relHealth = 'warning';
      }

      if (relHealth === 'healthy') {
        status.healthy++;
      } else {
        status.warnings++;
      }
    }

    return status;
  }

  /**
   * Inspect event health
   */
  _inspectEvents() {
    const status = {
      total: this.blueprint.events.length,
      healthy: 0,
      warnings: 0,
      issues: []
    };

    for (const event of this.blueprint.events) {
      let eventHealth = 'healthy';

      if (!event.payload || event.payload.length === 0) {
        status.issues.push(`${event.name}: Empty payload`);
        eventHealth = 'warning';
      }

      if (eventHealth === 'healthy') {
        status.healthy++;
      } else {
        status.warnings++;
      }
    }

    return status;
  }

  /**
   * Calculate system metrics
   */
  _calculateMetrics() {
    const metrics = {
      entity_count: this.blueprint.entities.length,
      relationship_count: this.blueprint.relationships.length,
      event_count: this.blueprint.events.length,
      permission_count: this.blueprint.permissions.length,
      validation_rule_count: this.blueprint.validation_rules.length,
      dashboard_contract_count: this.blueprint.dashboard_contracts.length,
      avg_relationships_per_entity: 0,
      entity_types: {},
      relationship_types: {},
      event_aggregates: {}
    };

    // Calculate entity types
    for (const entity of this.blueprint.entities) {
      metrics.entity_types[entity.entity_type] = (metrics.entity_types[entity.entity_type] || 0) + 1;
    }

    // Calculate relationship types
    for (const rel of this.blueprint.relationships) {
      metrics.relationship_types[rel.type] = (metrics.relationship_types[rel.type] || 0) + 1;
    }

    // Calculate event aggregates
    for (const event of this.blueprint.events) {
      metrics.event_aggregates[event.aggregate] = (metrics.event_aggregates[event.aggregate] || 0) + 1;
    }

    // Average relationships
    const relationshipCounts = {};
    for (const rel of this.blueprint.relationships) {
      relationshipCounts[rel.source] = (relationshipCounts[rel.source] || 0) + 1;
    }
    const total = Object.values(relationshipCounts).reduce((a, b) => a + b, 0);
    metrics.avg_relationships_per_entity = this.blueprint.entities.length > 0 ? (total / this.blueprint.entities.length).toFixed(2) : 0;

    return metrics;
  }

  /**
   * Determine overall health
   */
  _determineHealth(entityStatus, relationshipStatus, eventStatus) {
    const totalComponents = 
      entityStatus.total + 
      relationshipStatus.total + 
      eventStatus.total;

    const totalHealthy = 
      entityStatus.healthy + 
      relationshipStatus.healthy + 
      eventStatus.healthy;

    const percentage = totalComponents > 0 
      ? Math.round((totalHealthy / totalComponents) * 100) 
      : 100;

    let status = 'HEALTHY';
    if (percentage < 100 && percentage >= 80) status = 'DEGRADED';
    if (percentage < 80 && percentage >= 50) status = 'WARNING';
    if (percentage < 50) status = 'CRITICAL';

    return { status, percentage };
  }

  /**
   * Generate recommendations
   */
  _generateRecommendations(health, metrics) {
    const recommendations = [];

    // Recommendation: Entity coverage
    if (metrics.entity_count < 8) {
      recommendations.push({
        severity: 'info',
        message: 'Consider adding more entity types for comprehensive coverage',
        action: 'Add entities for additional tracking capabilities'
      });
    }

    // Recommendation: Event coverage
    const avgEventsPerEntity = metrics.event_count / metrics.entity_count;
    if (avgEventsPerEntity < 1) {
      recommendations.push({
        severity: 'warning',
        message: 'Low event coverage - some entities may not emit events',
        action: 'Define events for all critical entities'
      });
    }

    // Recommendation: Health
    if (health.percentage < 100) {
      recommendations.push({
        severity: 'warning',
        message: `Architecture health is ${health.percentage}% - review warnings`,
        action: 'Address reported issues to improve system health'
      });
    }

    // Recommendation: Validation rules
    if (metrics.validation_rule_count < 3) {
      recommendations.push({
        severity: 'info',
        message: 'Consider adding more validation rules for data quality',
        action: 'Define additional validation rules for critical entities'
      });
    }

    // Positive feedback
    if (health.percentage === 100 && metrics.dashboard_contract_count >= 6) {
      recommendations.push({
        severity: 'success',
        message: 'Architecture is well-designed and comprehensive',
        action: 'System is ready for implementation'
      });
    }

    return recommendations;
  }

  /**
   * Inspect specific entity
   */
  inspectEntity(name) {
    const entity = this.blueprint.entities.find(e => e.name === name);
    if (!entity) {
      return { error: `Entity ${name} not found` };
    }

    const incomingRels = this.blueprint.relationships.filter(r => r.target === name);
    const outgoingRels = this.blueprint.relationships.filter(r => r.source === name);

    return {
      name: entity.name,
      type: entity.entity_type,
      fields_count: (entity.fields || []).length,
      lifecycle_stages: entity.lifecycle_stages,
      events_emitted: entity.events_emitted,
      incoming_relationships: incomingRels.map(r => `${r.source}→${name}`),
      outgoing_relationships: outgoingRels.map(r => `${name}→${r.target}`)
    };
  }

  /**
   * Get architecture layers
   */
  getArchitectureLayers() {
    const layers = {
      entity_layer: this.blueprint.entities.map(e => e.name),
      event_layer: this.blueprint.events.map(e => e.name),
      permission_layer: this.blueprint.permissions.map(p => p.role),
      rule_layer: this.blueprint.validation_rules.map(r => r.name),
      dashboard_layer: this.blueprint.dashboard_contracts.map(c => c.name)
    };

    return layers;
  }

  /**
   * Get conversion funnel (scan → lead → sale)
   */
  getConversionFunnel() {
    const funnel = {
      scan_entity: 'ReferralEvent',
      lead_entity: 'LeadEvent',
      sale_entity: 'SaleEvent',
      attribution_entity: 'AttributionRecord',
      payout_entity: 'PartnerPayout',
      funnel_path: ['ReferralEvent', 'LeadEvent', 'SaleEvent', 'AttributionRecord', 'PartnerPayout'],
      events_in_funnel: ['qr.scanned', 'lead.created', 'sale.attributed', 'commission.earned', 'payout.created']
    };

    return funnel;
  }

  /**
   * Generate inspection report
   */
  generateReport(format = 'text') {
    const inspection = this.inspectArchitecture();

    if (format === 'json') {
      return JSON.stringify(inspection, null, 2);
    }

    // Text format
    const lines = [];
    lines.push('╔═════════════════════════════════════════════════════════════════════╗');
    lines.push('║  Partner & QR Identity Engine - Architecture Inspection Report      ║');
    lines.push('╚═════════════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`Timestamp: ${inspection.timestamp}`);
    lines.push(`Health Status: ${inspection.health_status}`);
    lines.push(`Health Percentage: ${inspection.health_percentage}%`);
    lines.push('');

    lines.push('ENTITY STATUS:');
    lines.push(`  Total Entities: ${inspection.entity_status.total}`);
    lines.push(`  Healthy: ${inspection.entity_status.healthy}`);
    lines.push(`  Warnings: ${inspection.entity_status.warnings}`);
    if (inspection.entity_status.issues.length > 0) {
      for (const issue of inspection.entity_status.issues) {
        lines.push(`    - ${issue}`);
      }
    }
    lines.push('');

    lines.push('RELATIONSHIP STATUS:');
    lines.push(`  Total Relationships: ${inspection.relationship_status.total}`);
    lines.push(`  Healthy: ${inspection.relationship_status.healthy}`);
    lines.push(`  Warnings: ${inspection.relationship_status.warnings}`);
    if (inspection.relationship_status.issues.length > 0) {
      for (const issue of inspection.relationship_status.issues.slice(0, 3)) {
        lines.push(`    - ${issue}`);
      }
    }
    lines.push('');

    lines.push('METRICS:');
    lines.push(`  Entities: ${inspection.metrics.entity_count}`);
    lines.push(`  Relationships: ${inspection.metrics.relationship_count}`);
    lines.push(`  Events: ${inspection.metrics.event_count}`);
    lines.push(`  Permissions: ${inspection.metrics.permission_count}`);
    lines.push(`  Validation Rules: ${inspection.metrics.validation_rule_count}`);
    lines.push(`  Dashboard Contracts: ${inspection.metrics.dashboard_contract_count}`);
    lines.push(`  Avg Relationships/Entity: ${inspection.metrics.avg_relationships_per_entity}`);
    lines.push('');

    if (inspection.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:');
      for (const rec of inspection.recommendations) {
        const icon = rec.severity === 'success' ? '✓' : rec.severity === 'warning' ? '⚠' : 'ℹ';
        lines.push(`  ${icon} ${rec.message}`);
        lines.push(`    → ${rec.action}`);
      }
    }

    return lines.join('\n');
  }
}
