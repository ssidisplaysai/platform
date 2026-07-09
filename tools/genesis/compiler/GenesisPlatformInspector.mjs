/**
 * GenesisPlatformInspector.mjs
 *
 * Genesis Meta Compiler - Platform Inspector
 * Inspects and analyzes Genesis architecture
 *
 * @module tools/genesis/compiler/GenesisPlatformInspector.mjs
 */

import { createGenesisPlatformBlueprint, ArchitectureInspection } from './GenesisPlatformBlueprint.mjs';

export class GenesisPlatformInspector {
  constructor() {
    this.blueprint = createGenesisPlatformBlueprint();
    this.inspection = null;
  }

  /**
   * Run complete architecture inspection
   */
  async inspectArchitecture() {
    const inspection = new ArchitectureInspection({
      blueprintId: this.blueprint.id
    });

    inspection.timestamp = new Date().toISOString();
    inspection.componentCount = this.blueprint.components.length;
    inspection.relationshipCount = this.blueprint.relationships.length;

    // Inspect each component
    for (const component of this.blueprint.components) {
      const componentStatus = this.inspectComponent(component);
      inspection.addComponentStatus(component.name, componentStatus);
    }

    // Inspect each relationship
    for (const relationship of this.blueprint.relationships) {
      const relationshipStatus = this.inspectRelationship(relationship);
      inspection.addRelationshipStatus(relationship.id, relationshipStatus);
    }

    // Calculate metrics
    this.calculateMetrics(inspection);

    // Determine overall health
    inspection.health = this.determineHealth(inspection);

    // Generate summary
    inspection.summary = this.generateSummary(inspection);

    // Add recommendations
    this.generateRecommendations(inspection);

    this.inspection = inspection;
    return inspection;
  }

  /**
   * Inspect individual component
   */
  inspectComponent(component) {
    const status = {
      name: component.name,
      type: component.type,
      status: component.status,
      lifecycleStatus: component.status_lifecycle,
      dependencyCount: (component.dependencies || []).length,
      capabilityCount: (component.capabilities || []).length,
      health: 'healthy',
      issues: []
    };

    // Check component health
    if (component.status === 'deprecated') {
      status.health = 'degraded';
      status.issues.push('Component is deprecated');
    }

    if (component.status === 'beta') {
      status.health = 'stable'; // Beta is acceptable
      status.issues.push('Component is in beta status');
    }

    if (!component.description || component.description.length === 0) {
      status.issues.push('Missing description');
    }

    if ((component.dependencies || []).length === 0 && component.name !== 'RuntimeEngine') {
      // Not necessarily an issue, but noteworthy
      status.issues.push('No declared dependencies');
    }

    if ((component.capabilities || []).length === 0) {
      status.issues.push('No declared capabilities');
    }

    return status;
  }

  /**
   * Inspect individual relationship
   */
  inspectRelationship(relationship) {
    const status = {
      id: relationship.id,
      from: relationship.source,
      to: relationship.target,
      type: relationship.type,
      required: relationship.required,
      status: relationship.status,
      health: 'healthy',
      issues: []
    };

    // Check relationship health
    if (!relationship.required) {
      status.issues.push('Optional relationship');
    }

    if (relationship.synchronicity === 'sync') {
      status.issues.push('Synchronous data flow (potential bottleneck)');
    }

    if (!relationship.description || relationship.description.length === 0) {
      status.issues.push('Missing description');
    }

    if ((relationship.dataFlow || []).length === 0) {
      status.issues.push('No data flow specification');
    }

    return status;
  }

  /**
   * Calculate architecture metrics
   */
  calculateMetrics(inspection) {
    const metrics = {};

    // Component metrics
    const componentsByType = {};
    for (const component of this.blueprint.components) {
      componentsByType[component.type] = (componentsByType[component.type] || 0) + 1;
    }
    metrics.componentsByType = componentsByType;

    // Relationship metrics
    const relationshipsByType = {};
    const requiredRelationships = [];
    const optionalRelationships = [];

    for (const rel of this.blueprint.relationships) {
      relationshipsByType[rel.type] = (relationshipsByType[rel.type] || 0) + 1;
      if (rel.required) {
        requiredRelationships.push(rel);
      } else {
        optionalRelationships.push(rel);
      }
    }

    metrics.relationshipsByType = relationshipsByType;
    metrics.requiredRelationshipCount = requiredRelationships.length;
    metrics.optionalRelationshipCount = optionalRelationships.length;

    // Dependency metrics
    let totalDependencies = 0;
    let maxDependencies = 0;
    let componentWithMostDependencies = '';

    for (const component of this.blueprint.components) {
      const depCount = (component.dependencies || []).length;
      totalDependencies += depCount;
      if (depCount > maxDependencies) {
        maxDependencies = depCount;
        componentWithMostDependencies = component.name;
      }
    }

    metrics.averageDependenciesPerComponent = (totalDependencies / this.blueprint.components.length).toFixed(2);
    metrics.maxDependencies = maxDependencies;
    metrics.componentWithMostDependencies = componentWithMostDependencies;

    // Capability metrics
    let totalCapabilities = 0;
    const capabilityDistribution = {};

    for (const component of this.blueprint.components) {
      for (const capability of (component.capabilities || [])) {
        capabilityDistribution[capability] = (capabilityDistribution[capability] || 0) + 1;
        totalCapabilities++;
      }
    }

    metrics.totalCapabilities = totalCapabilities;
    metrics.capabilityDistribution = capabilityDistribution;

    inspection.metrics = metrics;
  }

  /**
   * Determine overall architecture health
   */
  determineHealth(inspection) {
    const componentStatuses = Object.values(inspection.components);
    const relationshipStatuses = Object.values(inspection.relationships);

    let healthyComponents = 0;
    let degradedComponents = 0;
    let criticalComponents = 0;

    for (const status of componentStatuses) {
      if (status.health === 'healthy') healthyComponents++;
      else if (status.health === 'degraded') degradedComponents++;
      else if (status.health === 'critical') criticalComponents++;
    }

    // Calculate health percentage
    const healthPercentage = (healthyComponents / componentStatuses.length) * 100;

    if (criticalComponents > 0) {
      return 'critical';
    } else if (healthPercentage < 50) {
      return 'degraded';
    } else if (degradedComponents > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate inspection summary
   */
  generateSummary(inspection) {
    const metrics = inspection.metrics;
    
    let summary = `Architecture Status: ${inspection.health.toUpperCase()}. `;
    summary += `${inspection.componentCount} components, `;
    summary += `${inspection.relationshipCount} relationships. `;
    summary += `Avg ${metrics.averageDependenciesPerComponent} dependencies per component. `;

    if (inspection.health === 'healthy') {
      summary += 'All systems operational.';
    } else if (inspection.health === 'degraded') {
      summary += 'Some components need attention.';
    } else {
      summary += 'Critical issues detected.';
    }

    return summary;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(inspection) {
    const recommendations = [];

    // Check for highly dependent components
    if (inspection.metrics.maxDependencies > 5) {
      recommendations.push({
        priority: 'medium',
        type: 'complexity',
        description: `${inspection.metrics.componentWithMostDependencies} has ${inspection.metrics.maxDependencies} dependencies. Consider decomposition.`,
        action: 'Review component coupling'
      });
    }

    // Check for isolated components
    for (const [name, status] of Object.entries(inspection.components)) {
      if (status.dependencyCount === 0 && name !== 'RuntimeEngine') {
        recommendations.push({
          priority: 'low',
          type: 'integration',
          description: `${name} has no declared dependencies. Ensure it's properly integrated.`,
          action: 'Review component integration'
        });
      }
    }

    // Check for beta components
    const betaComponents = Object.values(inspection.components).filter(c => c.status === 'beta');
    if (betaComponents.length > 0) {
      recommendations.push({
        priority: 'low',
        type: 'stability',
        description: `${betaComponents.length} components in beta status. Monitor for stability.`,
        action: 'Track beta component stability'
      });
    }

    // Check for deprecated components
    const deprecatedComponents = Object.values(inspection.components).filter(c => c.status === 'deprecated');
    if (deprecatedComponents.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'maintenance',
        description: `${deprecatedComponents.length} deprecated components still in use. Plan migration.`,
        action: 'Migrate deprecated components'
      });
    }

    inspection.recommendations = recommendations;
  }

  /**
   * Get detailed component information
   */
  getComponentInfo(componentName) {
    const component = this.blueprint.getComponent(componentName);
    if (!component) return null;

    const info = {
      component,
      incomingRelationships: this.blueprint.relationships.filter(r => r.target === componentName),
      outgoingRelationships: this.blueprint.relationships.filter(r => r.source === componentName),
      dependentComponents: this.blueprint.components.filter(c => 
        (c.dependencies || []).includes(componentName)
      )
    };

    return info;
  }

  /**
   * Get architecture layers
   */
  getArchitectureLayers() {
    const layers = {
      runtime: this.blueprint.getComponentsByType('runtime'),
      compilers: this.blueprint.getComponentsByType('compiler'),
      engines: this.blueprint.getComponentsByType('engine'),
      infrastructure: this.blueprint.getComponentsByType('graph').concat(
        this.blueprint.getComponentsByType('twin'),
        this.blueprint.getComponentsByType('system')
      ),
      interfaces: this.blueprint.getComponentsByType('cli'),
      orchestration: this.blueprint.getComponentsByType('orchestrator')
    };

    return layers;
  }

  /**
   * Get compilation pipeline
   */
  getCompilationPipeline() {
    const compilers = this.blueprint.getComponentsByType('compiler');
    
    const pipeline = {
      compilers: compilers.map(c => ({
        name: c.name,
        capabilities: c.capabilities,
        dependencies: c.dependencies
      })),
      flow: []
    };

    // Try to determine pipeline flow from dependencies
    const pipelineOrder = ['BusinessCompiler', 'ObjectCompiler', 'ModuleCompiler', 'ApplicationCompiler', 'SolutionCompiler'];
    for (const name of pipelineOrder) {
      const compiler = this.blueprint.getComponent(name);
      if (compiler) {
        pipeline.flow.push(name);
      }
    }

    return pipeline;
  }

  /**
   * Generate inspection report
   */
  generateReport(format = 'text') {
    if (!this.inspection) return 'No inspection result available';

    if (format === 'json') {
      return JSON.stringify(this.inspection.toJSON(), null, 2);
    }

    let report = '';
    report += `\n${'═'.repeat(50)}\n`;
    report += `Genesis Architecture Inspection Report\n`;
    report += `${'═'.repeat(50)}\n\n`;

    report += `Timestamp: ${this.inspection.timestamp}\n`;
    report += `Health Status: ${this.inspection.health.toUpperCase()}\n`;
    report += `Summary: ${this.inspection.summary}\n\n`;

    report += `Architecture Composition:\n`;
    report += `  • Total Components: ${this.inspection.componentCount}\n`;
    report += `  • Total Relationships: ${this.inspection.relationshipCount}\n\n`;

    const layers = this.getArchitectureLayers();
    report += `Component Layers:\n`;
    report += `  • Runtime: ${layers.runtime.length}\n`;
    report += `  • Compilers: ${layers.compilers.length}\n`;
    report += `  • Engines: ${layers.engines.length}\n`;
    report += `  • Infrastructure: ${layers.infrastructure.length}\n`;
    report += `  • Interfaces: ${layers.interfaces.length}\n`;
    report += `  • Orchestration: ${layers.orchestration.length}\n\n`;

    if (this.inspection.metrics) {
      report += `Metrics:\n`;
      report += `  • Avg Dependencies/Component: ${this.inspection.metrics.averageDependenciesPerComponent}\n`;
      report += `  • Max Dependencies: ${this.inspection.metrics.maxDependencies} (${this.inspection.metrics.componentWithMostDependencies})\n`;
      report += `  • Total Capabilities: ${this.inspection.metrics.totalCapabilities}\n\n`;
    }

    if (this.inspection.recommendations.length > 0) {
      report += `Recommendations:\n`;
      this.inspection.recommendations.forEach((rec, i) => {
        const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        report += `  ${priorityIcon} ${i + 1}. [${rec.type.toUpperCase()}] ${rec.description}\n`;
        report += `     Action: ${rec.action}\n`;
      });
      report += '\n';
    }

    report += `Compilation Pipeline:\n`;
    const pipeline = this.getCompilationPipeline();
    if (pipeline.flow.length > 0) {
      report += `  ${pipeline.flow.join(' → ')}\n\n`;
    }

    report += `Component Status:\n`;
    for (const [name, status] of Object.entries(this.inspection.components)) {
      const healthIcon = status.health === 'healthy' ? '✅' : status.health === 'degraded' ? '⚠️' : '❌';
      report += `  ${healthIcon} ${name} (${status.type}) - ${status.status}\n`;
      if (status.issues.length > 0) {
        status.issues.forEach(issue => {
          report += `     • ${issue}\n`;
        });
      }
    }

    report += `\n${'═'.repeat(50)}\n`;

    return report;
  }
}

export async function inspectGenesisPlatform() {
  const inspector = new GenesisPlatformInspector();
  const inspection = await inspector.inspectArchitecture();
  return inspection;
}

export async function runInspectionCommand(options = {}) {
  const verbose = options.verbose || false;
  const format = options.format || 'text';
  const componentName = options.component || null;

  const inspector = new GenesisPlatformInspector();

  if (verbose) {
    console.log('\n🔎 Genesis Platform Inspector\n');
    console.log('Analyzing architecture...');
  }

  const inspection = await inspector.inspectArchitecture();

  if (componentName) {
    const componentInfo = inspector.getComponentInfo(componentName);
    if (!componentInfo) {
      console.log(`Component '${componentName}' not found`);
      return;
    }

    console.log(`\n📦 Component: ${componentName}`);
    console.log(`   Type: ${componentInfo.component.type}`);
    console.log(`   Status: ${componentInfo.component.status}`);
    console.log(`   Description: ${componentInfo.component.description}`);
    console.log(`\n   Capabilities: ${(componentInfo.component.capabilities || []).join(', ') || 'None'}`);
    console.log(`\n   Dependencies: ${(componentInfo.component.dependencies || []).join(', ') || 'None'}`);
    console.log(`\n   Incoming Relationships: ${componentInfo.incomingRelationships.length}`);
    componentInfo.incomingRelationships.forEach(rel => {
      console.log(`     • ${rel.source} (${rel.type})`);
    });
    console.log(`\n   Outgoing Relationships: ${componentInfo.outgoingRelationships.length}`);
    componentInfo.outgoingRelationships.forEach(rel => {
      console.log(`     • ${rel.target} (${rel.type})`);
    });
    return;
  }

  if (format === 'json') {
    console.log(JSON.stringify(inspection.toJSON(), null, 2));
  } else {
    console.log(inspector.generateReport(format));
  }
}

export default {
  GenesisPlatformInspector,
  inspectGenesisPlatform,
  runInspectionCommand
};
