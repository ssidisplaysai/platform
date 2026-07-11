/**
 * ModuleDashboardGenerator - Generates dashboard contracts from module metadata
 *
 * Creates comprehensive dashboard definitions from member objects, lifecycle data,
 * events, search, relationships, and aggregated metadata.
 *
 * Purpose:
 *   - Generate dashboard layouts from module metadata
 *   - Provide summary cards and metrics
 *   - Define activity streams and alerts
 *   - Create quick action definitions
 *   - Generate dashboard documentation
 *
 * Output:
 *   - Complete dashboard definition with sections
 *   - Metadata-driven components and data sources
 *   - No hardcoded values or module-specific logic
 *
 * @module tools/genesis/compiler/contracts/ModuleDashboardGenerator
 */

/**
 * Generate dashboard contract from module metadata
 *
 * @param {string} moduleId - Module identifier
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<string>} memberObjectNames - Member object names (from ENTITY_MODULE_MAP)
 * @param {Object} blueprint - ModuleBlueprint IR with loaded member objects
 * @returns {Object} Dashboard contract definition
 */
export function generateDashboard(moduleId, moduleMetadata, memberObjectNames, blueprint) {
  // Use blueprint's member objects which are already loaded
  const memberObjects = blueprint.members.objects;

  const dashboard = {
    id: `dashboard:${moduleId}`,
    moduleId,
    name: `${moduleMetadata.name} Dashboard`,
    description: `Executive dashboard for ${moduleMetadata.name} module`,

    layout: {
      sections: [
        generateSummarySection(moduleMetadata, memberObjects, blueprint),
        generateObjectsSection(memberObjects, blueprint),
        generateActivitySection(moduleMetadata, blueprint),
        generateAlertsSection(blueprint),
        generateActionsSection(memberObjects, moduleMetadata),
        generateInsightsSection(blueprint)
      ]
    },

    widgets: generateWidgets(moduleMetadata, memberObjects, blueprint),

    dataConnections: generateDataConnections(moduleId, memberObjects, blueprint),

    permissions: generateDashboardPermissions(blueprint),

    metadata: {
      created: new Date().toISOString(),
      generator: 'ModuleDashboardGenerator',
      phase: 'Module Operational Dashboards',
      version: '1.0.0'
    }
  };

  return dashboard;
}

/**
 * Generate summary section with overview cards
 *
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Summary section definition
 */
function generateSummarySection(moduleMetadata, memberObjects, blueprint) {
  return {
    id: 'section:summary',
    type: 'summary',
    title: 'Overview',
    description: 'Module summary and key metrics',
    layout: 'grid',
    cards: [
      {
        id: 'card:module-info',
        type: 'info',
        title: moduleMetadata.name,
        metrics: [
          {
            label: 'Domain',
            value: moduleMetadata.domain,
            icon: 'globe'
          },
          {
            label: 'Tier',
            value: moduleMetadata.tier,
            icon: 'tier'
          },
          {
            label: 'Objects',
            value: memberObjects.length,
            icon: 'objects'
          },
          {
            label: 'Completeness',
            value: `${blueprint.quality.percentage}%`,
            icon: 'check'
          }
        ]
      },
      {
        id: 'card:object-counts',
        type: 'metric',
        title: 'Object Inventory',
        description: 'Count of objects by type',
        metrics: memberObjects.map(obj => ({
          label: obj.name,
          count: 1,
          pluralLabel: 'items',
          route: `/modules/${moduleMetadata.namespace}/${obj.name.toLowerCase()}`,
          color: generateColorForObject(obj.name)
        }))
      },
      {
        id: 'card:lifecycle-status',
        type: 'status',
        title: 'Lifecycle States',
        description: 'Aggregated lifecycle state distribution',
        states: generateLifecycleMetrics(blueprint),
        dataSource: 'lifecycle-aggregation'
      },
      {
        id: 'card:capabilities',
        type: 'capability',
        title: 'Capabilities',
        description: 'Module capability status',
        capabilities: blueprint.capabilities.summary.map(cap => ({
          name: cap.name,
          enabled: cap.enabled,
          disabled: cap.disabled,
          total: cap.total,
          enablementPercentage: cap.percentage
        }))
      }
    ]
  };
}

/**
 * Generate objects section with detailed object information
 *
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Objects section definition
 */
function generateObjectsSection(memberObjects, blueprint) {
  return {
    id: 'section:objects',
    type: 'objects',
    title: 'Objects',
    description: 'Detailed information about module objects',
    layout: 'list',
    objects: memberObjects.map(obj => {
      return {
        id: `object:${obj.name.toLowerCase()}`,
        name: obj.name,
        registryKey: obj.registryKey,
        fields: obj.registration?.structure?.fields?.total || 0,
        relationships: obj.registration?.structure?.relationships?.total || 0,
        lifecycleStates: obj.registration?.structure?.lifecycle?.states || 0,
        capabilities: obj.registration?.capabilities?.enabled || 0,
        artifacts: obj.artifacts?.length || 0,
        actions: [
          {
            label: 'Browse',
            route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}`,
            icon: 'list'
          },
          {
            label: 'Create',
            route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}/create`,
            icon: 'plus'
          }
        ]
      };
    })
  };
}

/**
 * Generate activity section with recent activity stream
 *
 * @param {Object} moduleMetadata - Module metadata
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Activity section definition
 */
function generateActivitySection(moduleMetadata, blueprint) {
  return {
    id: 'section:activity',
    type: 'activity',
    title: 'Activity',
    description: 'Recent activity and events',
    layout: 'stream',
    dataSource: 'activity-stream',
    refreshInterval: 60000,
    activities: [
      {
        id: 'activity:recent-objects',
        type: 'recent',
        title: 'Recent Objects',
        description: 'Recently created or modified objects',
        icon: 'history',
        limit: 5
      },
      {
        id: 'activity:events',
        type: 'events',
        title: 'Module Events',
        description: 'Recent module-level events',
        icon: 'bell',
        limit: 10,
        eventTypes: blueprint.lifecycle.events || []
      }
    ]
  };
}

/**
 * Generate alerts section with system alerts
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Alerts section definition
 */
function generateAlertsSection(blueprint) {
  const alerts = [];

  // Completeness alert
  if (blueprint.quality.percentage < 80) {
    alerts.push({
      id: 'alert:completeness',
      type: 'warning',
      severity: 'medium',
      title: 'Incomplete Configuration',
      message: `Module completeness at ${blueprint.quality.percentage}%, target is 100%`,
      icon: 'warning',
      action: {
        label: 'Review',
        route: '/settings/module-quality'
      }
    });
  }

  // Capability alert
  const disabledCount = blueprint.capabilities.summary.reduce((acc, cap) => acc + cap.disabled, 0);
  if (disabledCount > 0) {
    alerts.push({
      id: 'alert:capabilities',
      type: 'info',
      severity: 'low',
      title: 'Disabled Capabilities',
      message: `${disabledCount} capabilities are disabled`,
      icon: 'info',
      action: {
        label: 'Enable',
        route: '/settings/capabilities'
      }
    });
  }

  // Relationship alert
  if (blueprint.relationships.count > 0) {
    alerts.push({
      id: 'alert:dependencies',
      type: 'info',
      severity: 'low',
      title: 'External Dependencies',
      message: `This module depends on ${blueprint.relationships.count} other module(s)`,
      icon: 'link',
      action: {
        label: 'View',
        route: '/settings/dependencies'
      }
    });
  }

  return {
    id: 'section:alerts',
    type: 'alerts',
    title: 'Alerts & Status',
    description: 'System alerts and status notifications',
    layout: 'vertical',
    alerts,
    emptyState: {
      show: alerts.length === 0,
      message: 'No alerts - module is operating normally'
    }
  };
}

/**
 * Generate primary actions section
 *
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} moduleMetadata - Module metadata
 * @returns {Object} Actions section definition
 */
function generateActionsSection(memberObjects, moduleMetadata) {
  const actions = [];

  // Add create action for each object
  for (const obj of memberObjects) {
    actions.push({
      id: `action:create-${obj.name.toLowerCase()}`,
      type: 'create',
      label: `New ${obj.name}`,
      description: `Create a new ${obj.name}`,
      icon: 'plus',
      route: `/modules/${moduleMetadata.namespace}/${obj.name.toLowerCase()}/create`,
      color: generateColorForObject(obj.name)
    });
  }

  // Add search action
  actions.push({
    id: 'action:search',
    type: 'search',
    label: 'Search',
    description: 'Search all objects in module',
    icon: 'search',
    route: `/modules/${moduleMetadata.namespace}/search`,
    color: 'blue'
  });

  // Add settings action
  actions.push({
    id: 'action:settings',
    type: 'settings',
    label: 'Settings',
    description: 'Module settings and configuration',
    icon: 'gear',
    route: `/modules/${moduleMetadata.namespace}/settings`,
    color: 'gray'
  });

  return {
    id: 'section:actions',
    type: 'actions',
    title: 'Quick Actions',
    description: 'Common tasks and shortcuts',
    layout: 'grid',
    columns: 4,
    actions
  };
}

/**
 * Generate insights section with cross-object insights
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Insights section definition
 */
function generateInsightsSection(blueprint) {
  const insights = [];

  // Relationship insights
  if (blueprint.relationships.dependencies && blueprint.relationships.dependencies.length > 0) {
    insights.push({
      id: 'insight:relationships',
      type: 'relationships',
      title: 'Related Modules',
      description: 'Objects with cross-module relationships',
      dependencies: blueprint.relationships.dependencies.map(dep => ({
        module: dep.module,
        namespace: dep.namespace,
        entities: dep.entities || [],
        type: dep.type
      }))
    });
  }

  // Artifact insights
  if (blueprint.artifacts.totalCount > 0) {
    insights.push({
      id: 'insight:artifacts',
      type: 'artifacts',
      title: 'Generated Artifacts',
      description: 'Artifacts generated for module objects',
      totalCount: blueprint.artifacts.totalCount,
      byType: blueprint.artifacts.byType.slice(0, 3).map(at => ({
        type: at.type,
        count: at.count,
        percentage: at.percentage
      }))
    });
  }

  // Capability insights
  const enabledCapabilities = blueprint.capabilities.summary.filter(c => c.enabled > 0);
  if (enabledCapabilities.length > 0) {
    insights.push({
      id: 'insight:capabilities',
      type: 'capabilities',
      title: 'Enabled Capabilities',
      description: 'Active capabilities in this module',
      capabilities: enabledCapabilities.map(cap => ({
        name: cap.name,
        enablementPercentage: cap.percentage
      }))
    });
  }

  return {
    id: 'section:insights',
    type: 'insights',
    title: 'Insights',
    description: 'Cross-module insights and relationships',
    layout: 'vertical',
    insights,
    emptyState: {
      show: insights.length === 0,
      message: 'No insights available'
    }
  };
}

/**
 * Generate dashboard widgets
 *
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Widget definitions
 */
function generateWidgets(moduleMetadata, memberObjects, blueprint) {
  return [
    {
      id: 'widget:quick-stats',
      type: 'quickstats',
      title: 'Quick Stats',
      dataSource: {
        type: 'aggregation',
        fields: ['objectCount', 'completeness', 'enabledCapabilities']
      },
      refreshInterval: 300000
    },
    {
      id: 'widget:object-distribution',
      type: 'chart',
      chartType: 'pie',
      title: 'Object Distribution',
      dataSource: {
        type: 'object-count-aggregation',
        objects: memberObjects.map(obj => obj.name)
      },
      refreshInterval: 600000
    },
    {
      id: 'widget:lifecycle-distribution',
      type: 'chart',
      chartType: 'bar',
      title: 'Lifecycle State Distribution',
      dataSource: {
        type: 'lifecycle-aggregation'
      },
      refreshInterval: 300000
    },
    {
      id: 'widget:recent-activity',
      type: 'list',
      title: 'Recent Activity',
      dataSource: {
        type: 'activity-stream',
        limit: 10
      },
      refreshInterval: 60000
    }
  ];
}

/**
 * Generate data connections for dashboard
 *
 * @param {string} moduleId - Module identifier
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Data connection definitions
 */
function generateDataConnections(moduleId, memberObjects, blueprint) {
  return [
    {
      id: 'connection:activity-stream',
      type: 'stream',
      endpoint: `/api/v1/${blueprint.module.namespace}/activity`,
      dataType: 'activity',
      refreshInterval: 60000
    },
    {
      id: 'connection:object-count',
      type: 'aggregation',
      endpoint: `/api/v1/${blueprint.module.namespace}/stats/objects`,
      dataType: 'count',
      refreshInterval: 300000
    },
    {
      id: 'connection:lifecycle-stats',
      type: 'aggregation',
      endpoint: `/api/v1/${blueprint.module.namespace}/stats/lifecycle`,
      dataType: 'lifecycle',
      refreshInterval: 300000
    },
    ...memberObjects.map(obj => ({
      id: `connection:${obj.name.toLowerCase()}`,
      type: 'entity',
      endpoint: `/api/v1/${blueprint.module.namespace}/${obj.name.toLowerCase()}s`,
      dataType: obj.name,
      refreshInterval: 600000
    }))
  ];
}

/**
 * Generate dashboard-level permissions
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Dashboard permissions
 */
function generateDashboardPermissions(blueprint) {
  return {
    view: {
      roles: blueprint.permissions.roles || ['user', 'admin'],
      description: 'View module dashboard'
    },
    edit: {
      roles: blueprint.permissions.roles.filter(r => ['admin', 'manager'].includes(r)) || ['admin'],
      description: 'Edit dashboard layout and widgets'
    },
    manage: {
      roles: ['admin'],
      description: 'Manage dashboard and data sources'
    }
  };
}

/**
 * Generate lifecycle metrics from blueprint
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Lifecycle metrics
 */
function generateLifecycleMetrics(blueprint) {
  if (!blueprint.lifecycle || !blueprint.lifecycle.states) {
    return [];
  }

  return blueprint.lifecycle.states.map((state, idx) => ({
    label: state,
    count: 0,
    percentage: 0,
    color: generateColorForStatus(state, idx)
  })) || [];
}

/**
 * Generate color for object type
 *
 * @param {string} objectName - Object name
 * @returns {string} Color code
 */
function generateColorForObject(objectName) {
  const colors = [
    'blue', 'green', 'purple', 'orange', 'red', 'cyan', 'pink'
  ];
  const index = objectName.charCodeAt(0) % colors.length;
  return colors[index];
}

/**
 * Generate color for status
 *
 * @param {string} status - Status name
 * @param {number} index - Index for fallback
 * @returns {string} Color code
 */
function generateColorForStatus(status, index) {
  const statusColors = {
    active: 'green',
    inactive: 'gray',
    pending: 'yellow',
    archived: 'gray',
    draft: 'blue',
    published: 'green'
  };
  return statusColors[status.toLowerCase()] || ['red', 'orange', 'yellow', 'green', 'blue'][index % 5];
}

export {};
