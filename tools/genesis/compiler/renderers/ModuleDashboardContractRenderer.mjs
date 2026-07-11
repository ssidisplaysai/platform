/**
 * ModuleDashboardContractRenderer - Renders module dashboard contract files
 *
 * Generates standalone dashboard contract JSON files from ModuleBlueprint.
 * Provides complete dashboard definitions for UI consumption.
 *
 * Purpose:
 *   - Generate standalone dashboard manifests
 *   - Provide dashboard layouts and components
 *   - Define data sources and connections
 *   - Enable dashboard configuration
 *   - Support runtime dashboard building
 *
 * Output:
 *   - JSON file with complete dashboard definition
 *   - Schema reference for validation
 *   - Generation metadata
 *
 * @module tools/genesis/compiler/renderers/ModuleDashboardContractRenderer
 */

/**
 * Generate a dashboard contract JSON from ModuleBlueprint
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {string} JSON string of dashboard contract
 */
export function generateDashboardContract(blueprint) {
  const contract = {
    $schema: 'https://genesis.internal/schema/module-dashboard-contract.json',
    version: '1.0.0',
    generated: blueprint.metadata.generated,

    dashboard: {
      id: `dashboard:${blueprint.module.namespace}`,
      moduleId: blueprint.module.id,
      name: `${blueprint.module.name} Dashboard`,
      description: `Executive dashboard for ${blueprint.module.name} module`,
      namespace: blueprint.module.namespace,
      icon: generateDashboardIcon(blueprint.module.domain),
      theme: {
        colors: {
          primary: generatePrimaryColor(blueprint.module.tier),
          secondary: generateSecondaryColor(blueprint.module.domain),
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6'
        }
      }
    },

    layout: {
      type: 'adaptive',
      columns: 12,
      sections: blueprint.dashboard?.layout?.sections || []
    },

    cards: {
      summary: generateSummaryCards(blueprint),
      objects: generateObjectCards(blueprint),
      metrics: generateMetricCards(blueprint)
    },

    sections: {
      overview: {
        title: 'Overview',
        description: `${blueprint.module.name} module dashboard overview`,
        cards: ['module-info', 'object-counts', 'lifecycle-status', 'capabilities']
      },
      objects: {
        title: 'Objects',
        description: 'Module member objects and details',
        items: blueprint.members.objects.map(obj => ({
          name: obj.name,
          path: obj.path,
          count: 1,
          fields: getObjectFieldCount(obj, blueprint),
          relationships: getObjectRelationshipCount(obj, blueprint)
        }))
      },
      activity: {
        title: 'Activity',
        description: 'Recent activity and events',
        dataSource: 'activity-stream',
        refreshInterval: 60000
      },
      alerts: {
        title: 'Alerts & Status',
        description: 'System alerts and notifications',
        alerts: generateDashboardAlerts(blueprint)
      },
      actions: {
        title: 'Quick Actions',
        description: 'Common tasks and shortcuts',
        items: generateQuickActions(blueprint)
      },
      insights: {
        title: 'Insights',
        description: 'Cross-module insights',
        items: generateDashboardInsights(blueprint)
      }
    },

    widgets: {
      quick_stats: {
        type: 'stats',
        title: 'Quick Stats',
        layout: 'inline',
        stats: [
          {
            label: 'Total Objects',
            value: blueprint.members.count,
            icon: 'objects'
          },
          {
            label: 'Completeness',
            value: `${blueprint.quality.percentage}%`,
            icon: 'check'
          },
          {
            label: 'Enabled Capabilities',
            value: countEnabledCapabilities(blueprint),
            icon: 'star'
          },
          {
            label: 'External Dependencies',
            value: blueprint.relationships.count,
            icon: 'link'
          }
        ]
      },
      object_distribution: {
        type: 'chart',
        chartType: 'pie',
        title: 'Object Distribution',
        dataSource: {
          type: 'object-aggregation',
          endpoint: `/api/v1/${blueprint.module.namespace}/stats/objects`
        },
        refreshInterval: 600000
      },
      lifecycle_distribution: {
        type: 'chart',
        chartType: 'bar',
        title: 'Lifecycle States',
        dataSource: {
          type: 'lifecycle-aggregation',
          endpoint: `/api/v1/${blueprint.module.namespace}/stats/lifecycle`
        },
        refreshInterval: 300000
      },
      capabilities_overview: {
        type: 'list',
        title: 'Capabilities',
        layout: 'badges',
        items: blueprint.capabilities.summary.map(cap => ({
          label: cap.name,
          enabled: cap.enabled > 0,
          percentage: cap.percentage,
          color: cap.percentage > 80 ? 'green' : cap.percentage > 50 ? 'yellow' : 'red'
        }))
      },
      recent_activity: {
        type: 'stream',
        title: 'Recent Activity',
        dataSource: {
          type: 'activity-stream',
          endpoint: `/api/v1/${blueprint.module.namespace}/activity`,
          limit: 10
        },
        refreshInterval: 60000
      }
    },

    dataSources: generateDataSources(blueprint),

    permissions: {
      dashboard: {
        view: blueprint.permissions.roles.length > 0 ? blueprint.permissions.roles : ['user'],
        edit: ['admin', 'manager'],
        manage: ['admin']
      },
      actions: {
        create: blueprint.permissions.roles.length > 0 ? blueprint.permissions.roles : ['user'],
        read: blueprint.permissions.roles.length > 0 ? blueprint.permissions.roles : ['user'],
        update: ['admin', 'manager'],
        delete: ['admin']
      }
    },

    metadata: {
      version: '1.0.0',
      generated: blueprint.metadata.generated,
      moduleVersion: blueprint.module.id,
      objectCount: blueprint.members.count,
      completeness: blueprint.quality.percentage,
      readyForDeployment: blueprint.quality.deploymentReady.ready
    }
  };

  return JSON.stringify(contract, null, 2);
}

/**
 * Generate summary cards
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Summary card definitions
 */
function generateSummaryCards(blueprint) {
  return [
    {
      id: 'card:module-info',
      type: 'info',
      title: blueprint.module.name,
      layout: 'compact',
      fields: [
        { label: 'Domain', value: blueprint.module.domain },
        { label: 'Tier', value: blueprint.module.tier },
        { label: 'Objects', value: blueprint.members.count },
        { label: 'Completeness', value: `${blueprint.quality.percentage}%` }
      ]
    },
    {
      id: 'card:object-counts',
      type: 'metric',
      title: 'Object Inventory',
      layout: 'grid',
      items: blueprint.members.objects.map(obj => ({
        name: obj.name,
        count: 1,
        route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}`
      }))
    },
    {
      id: 'card:lifecycle-status',
      type: 'status',
      title: 'Lifecycle States',
      layout: 'inline',
      states: blueprint.lifecycle.states.map((state, idx) => ({
        label: state,
        count: 0,
        percentage: 0,
        color: generateStatusColor(state, idx)
      }))
    },
    {
      id: 'card:capabilities',
      type: 'capability',
      title: 'Capabilities Status',
      layout: 'grid',
      items: blueprint.capabilities.summary.map(cap => ({
        name: cap.name,
        enabled: cap.enabled,
        total: cap.total,
        percentage: cap.percentage
      }))
    }
  ];
}

/**
 * Generate object cards
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Object card definitions
 */
function generateObjectCards(blueprint) {
  return blueprint.members.objects.map(obj => ({
    id: `card:object-${obj.name.toLowerCase()}`,
    type: 'object',
    title: obj.name,
    name: obj.name,
    registryKey: obj.registryKey,
    fields: obj.registration?.structure?.fields?.total || 0,
    relationships: obj.registration?.structure?.relationships?.total || 0,
    actions: [
      {
        label: 'Browse',
        icon: 'list',
        route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}`
      },
      {
        label: 'Create',
        icon: 'plus',
        route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}/create`
      }
    ]
  }));
}

/**
 * Generate metric cards
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Metric card definitions
 */
function generateMetricCards(blueprint) {
  return [
    {
      id: 'card:completeness',
      type: 'progress',
      title: 'Module Completeness',
      value: blueprint.quality.percentage,
      target: 100,
      unit: '%'
    },
    {
      id: 'card:artifacts',
      type: 'stat',
      title: 'Generated Artifacts',
      value: blueprint.artifacts.totalCount,
      unit: 'files'
    },
    {
      id: 'card:relationships',
      type: 'stat',
      title: 'External Dependencies',
      value: blueprint.relationships.count,
      unit: 'modules'
    }
  ];
}

/**
 * Generate dashboard alerts
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Alert definitions
 */
function generateDashboardAlerts(blueprint) {
  const alerts = [];

  if (blueprint.quality.percentage < 80) {
    alerts.push({
      type: 'warning',
      severity: 'high',
      title: 'Incomplete Configuration',
      message: `Module completeness at ${blueprint.quality.percentage}%`
    });
  }

  if (blueprint.relationships.count > 2) {
    alerts.push({
      type: 'info',
      severity: 'low',
      title: 'Multiple Dependencies',
      message: `Module depends on ${blueprint.relationships.count} other modules`
    });
  }

  const disabledCaps = blueprint.capabilities.summary.filter(c => c.disabled > 0).length;
  if (disabledCaps > 0) {
    alerts.push({
      type: 'info',
      severity: 'low',
      title: 'Disabled Capabilities',
      message: `${disabledCaps} capability categories are disabled`
    });
  }

  return alerts;
}

/**
 * Generate quick actions
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Quick action definitions
 */
function generateQuickActions(blueprint) {
  const actions = [];

  // Create actions for each object
  for (const obj of blueprint.members.objects) {
    actions.push({
      id: `action:create-${obj.name.toLowerCase()}`,
      type: 'create',
      label: `New ${obj.name}`,
      icon: 'plus',
      route: `/modules/${blueprint.module.namespace}/${obj.name.toLowerCase()}/create`,
      color: generateActionColor(obj.name)
    });
  }

  // Search action
  actions.push({
    id: 'action:search',
    type: 'search',
    label: 'Search Module',
    icon: 'search',
    route: `/modules/${blueprint.module.namespace}/search`,
    color: 'blue'
  });

  return actions;
}

/**
 * Generate dashboard insights
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Array<Object>} Insight definitions
 */
function generateDashboardInsights(blueprint) {
  const insights = [];

  if (blueprint.relationships.dependencies?.length > 0) {
    insights.push({
      id: 'insight:relationships',
      type: 'relationships',
      title: 'Related Modules',
      count: blueprint.relationships.dependencies.length,
      modules: blueprint.relationships.dependencies.map(d => d.module)
    });
  }

  if (blueprint.artifacts.totalCount > 0) {
    insights.push({
      id: 'insight:artifacts',
      type: 'artifacts',
      title: 'Generated Artifacts',
      count: blueprint.artifacts.totalCount,
      topTypes: blueprint.artifacts.byType.slice(0, 3).map(t => t.type)
    });
  }

  return insights;
}

/**
 * Generate data sources
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {Object} Data source definitions
 */
function generateDataSources(blueprint) {
  return {
    'activity-stream': {
      type: 'stream',
      endpoint: `/api/v1/${blueprint.module.namespace}/activity`,
      method: 'GET',
      refreshInterval: 60000
    },
    'object-stats': {
      type: 'aggregation',
      endpoint: `/api/v1/${blueprint.module.namespace}/stats/objects`,
      method: 'GET',
      refreshInterval: 300000
    },
    'lifecycle-stats': {
      type: 'aggregation',
      endpoint: `/api/v1/${blueprint.module.namespace}/stats/lifecycle`,
      method: 'GET',
      refreshInterval: 300000
    },
    'capability-stats': {
      type: 'aggregation',
      endpoint: `/api/v1/${blueprint.module.namespace}/stats/capabilities`,
      method: 'GET',
      refreshInterval: 600000
    },
    ...Object.fromEntries(
      blueprint.members.objects.map(obj => [
        `${obj.name.toLowerCase()}-list`,
        {
          type: 'entity',
          endpoint: `/api/v1/${blueprint.module.namespace}/${obj.name.toLowerCase()}s`,
          method: 'GET',
          refreshInterval: 600000
        }
      ])
    )
  };
}

/**
 * Get object field count
 *
 * @param {Object} obj - Member object
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {number} Field count
 */
function getObjectFieldCount(obj, blueprint) {
  return obj.registration?.structure?.fields?.total || 0;
}

/**
 * Get object relationship count
 *
 * @param {Object} obj - Member object
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {number} Relationship count
 */
function getObjectRelationshipCount(obj, blueprint) {
  return obj.registration?.structure?.relationships?.total || 0;
}

/**
 * Count enabled capabilities
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {number} Count of enabled capabilities
 */
function countEnabledCapabilities(blueprint) {
  return blueprint.capabilities.summary.filter(c => c.enabled > 0).length;
}

/**
 * Generate dashboard icon
 *
 * @param {string} domain - Module domain
 * @returns {string} Icon identifier
 */
function generateDashboardIcon(domain) {
  const domainIcons = {
    sales: 'chart-line',
    procurement: 'shopping-cart',
    operations: 'cogs',
    inventory: 'boxes',
    manufacturing: 'factory',
    projects: 'tasks'
  };
  return domainIcons[domain] || 'dashboard';
}

/**
 * Generate primary color
 *
 * @param {string} tier - Module tier
 * @returns {string} Color code
 */
function generatePrimaryColor(tier) {
  const tierColors = {
    core: '#2563eb',
    extension: '#7c3aed',
    beta: '#f59e0b'
  };
  return tierColors[tier] || '#3b82f6';
}

/**
 * Generate secondary color
 *
 * @param {string} domain - Module domain
 * @returns {string} Color code
 */
function generateSecondaryColor(domain) {
  const domainColors = {
    sales: '#dc2626',
    procurement: '#0891b2',
    operations: '#059669',
    inventory: '#7c2d12',
    manufacturing: '#6366f1',
    projects: '#8b5cf6'
  };
  return domainColors[domain] || '#6b7280';
}

/**
 * Generate status color
 *
 * @param {string} status - Status name
 * @param {number} idx - Fallback index
 * @returns {string} Color code
 */
function generateStatusColor(status, idx) {
  const colors = {
    active: '#10b981',
    inactive: '#9ca3af',
    pending: '#f59e0b',
    archived: '#6b7280'
  };
  return colors[status.toLowerCase()] || ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6'][idx % 5];
}

/**
 * Generate action color
 *
 * @param {string} name - Object name
 * @returns {string} Color code
 */
function generateActionColor(name) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export {};
