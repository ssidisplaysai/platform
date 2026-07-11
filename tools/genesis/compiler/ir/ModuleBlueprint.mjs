/**
 * ModuleBlueprint - Internal Representation for Module Manifests
 *
 * Canonical IR for compiled module manifests.
 * Represents a complete module with all member objects, relationships, and aggregated metadata.
 *
 * Purpose:
 *   - Define contract for module compilation
 *   - Establish stable IR between ModuleCompiler and ModuleManifestRenderer
 *   - Enable metadata-driven module manifest generation
 *   - Provide module boundary validation
 *
 * Structure:
 *   - metadata: Generation and schema information
 *   - module: Module identification and classification
 *   - members: Objects belonging to this module
 *   - relationships: Dependencies on other modules
 *   - capabilities: Aggregated capability status
 *   - permissions: Aggregated permission summary
 *   - lifecycle: Aggregated lifecycle and event summary
 *   - artifacts: Generated artifact references for all members
 *   - registry: Discovery and initialization information
 *   - quality: Completeness and validation metrics
 *   - navigation: Module navigation routes and menus
 *   - api: Module API surface and endpoints
 *   - documentation: Module-level documentation
 *
 * @module tools/genesis/compiler/ir/ModuleBlueprint
 */

/**
 * ModuleBlueprint JSDoc type definition
 *
 * @typedef {Object} ModuleBlueprint
 * @property {Object} metadata - Generation metadata
 * @property {string} metadata.schema - Schema version URI
 * @property {string} metadata.version - Manifest version
 * @property {Object} metadata.generated - Generation details
 * @property {string} metadata.generated.at - ISO timestamp
 * @property {string} metadata.generated.by - Generator identifier
 * @property {string} metadata.generated.phase - Compiler phase
 *
 * @property {Object} module - Module identification
 * @property {string} module.id - Unique module identifier
 * @property {string} module.name - Display name
 * @property {string} module.namespace - Namespace/code identifier
 * @property {string} module.description - Module description
 * @property {string} module.tier - Tier classification (core, extension)
 * @property {string} module.domain - Domain/business area
 * @property {string} module.registryPath - Registry key for discovery
 *
 * @property {Object} members - Object membership
 * @property {number} members.count - Total objects in module
 * @property {Array<Object>} members.objects - List of member objects
 * @property {string} members.objects[].name - Entity name
 * @property {string} members.objects[].registryKey - Entity registry key
 * @property {string} members.objects[].path - Entity path in module
 * @property {Object} members.objects[].registration - Registration manifest data
 * @property {Object} members.objects[].module - Module manifest data
 * @property {Array<string>} members.objects[].artifacts - Artifact file references
 *
 * @property {Object} relationships - Module-to-module relationships
 * @property {number} relationships.count - Number of related modules
 * @property {Array<Object>} relationships.dependencies - Modules this module depends on
 * @property {string} relationships.dependencies[].module - Related module name
 * @property {string} relationships.dependencies[].namespace - Related module namespace
 * @property {string} relationships.dependencies[].type - Relationship type (reference, composition)
 * @property {Array<string>} relationships.dependencies[].entities - Entities with dependencies
 * @property {Array<Object>} relationships.dependents - Modules depending on this module
 *
 * @property {Object} capabilities - Aggregated capability status
 * @property {Array<Object>} capabilities.summary - Capability breakdown
 * @property {string} capabilities.summary[].name - Capability name
 * @property {number} capabilities.summary[].enabled - Count enabled
 * @property {number} capabilities.summary[].disabled - Count disabled
 * @property {number} capabilities.summary[].total - Total count
 * @property {number} capabilities.summary[].percentage - Percentage enabled
 *
 * @property {Object} permissions - Aggregated permission summary
 * @property {Array<string>} permissions.roles - Roles used in module
 * @property {number} permissions.rolePoliciesCount - Total role-policy mappings
 * @property {Array<Object>} permissions.policies - Distinct policies
 * @property {string} permissions.policies[].name - Policy name
 * @property {string} permissions.policies[].action - Action governed
 * @property {number} permissions.policies[].appliedToCount - Objects using policy
 *
 * @property {Object} lifecycle - Aggregated lifecycle and event summary
 * @property {Array<string>} lifecycle.states - All distinct lifecycle states
 * @property {Array<string>} lifecycle.events - All distinct events
 * @property {number} lifecycle.stateCount - Total distinct states
 * @property {number} lifecycle.eventCount - Total distinct events
 * @property {Array<Object>} lifecycle.transitions - State transitions
 *
 * @property {Object} artifacts - Generated artifact references
 * @property {number} artifacts.totalCount - Total artifacts for all members
 * @property {Array<Object>} artifacts.byType - Artifacts organized by type
 * @property {string} artifacts.byType[].type - Artifact type (repository, service, etc.)
 * @property {number} artifacts.byType[].count - Count of this artifact type
 * @property {Array<string>} artifacts.byType[].files - File paths
 *
 * @property {Object} registry - Discovery and registry information
 * @property {string} registry.modulePath - Registry path for module
 * @property {string} registry.objectsPath - Registry path for objects
 * @property {boolean} registry.discoverable - Whether module is discoverable
 * @property {boolean} registry.indexed - Whether module is indexed in registry
 * @property {string} registry.registryKey - Full registry key
 *
 * @property {Object} quality - Completeness and quality metrics
 * @property {number} quality.completeness - 0-100 completeness score
 * @property {number} quality.maxScore - Maximum possible score
 * @property {number} quality.percentage - Completeness percentage
 * @property {boolean} quality.complete - Whether manifest is complete
 * @property {Object} quality.validation - Validation status
 * @property {string} quality.validation.status - Status (pending, valid, invalid)
 * @property {Array<string>} quality.validation.checks - Checks performed
 * @property {number} quality.validation.passed - Checks passed
 * @property {number} quality.validation.total - Total checks
 * @property {Object} quality.deploymentReady - Deployment readiness
 * @property {boolean} quality.deploymentReady.ready - Ready for deployment
 * @property {number} quality.deploymentReady.percentage - Checks passed percentage
 *
 * @property {Object} navigation - Module navigation and routing
 * @property {string} navigation.homeRoute - Module home path (e.g., /modules/crm)
 * @property {Array<Object>} navigation.routes - Navigation routes
 * @property {string} navigation.routes[].label - Route display name
 * @property {string} navigation.routes[].path - Route path
 * @property {string} navigation.routes[].type - Route type (list, detail, create, search)
 * @property {string} navigation.routes[].object - Related object name (if any)
 * @property {Array<Object>} navigation.menus - Menu groups
 * @property {string} navigation.menus[].name - Menu group name
 * @property {Array<Object>} navigation.menus[].items - Menu items
 * @property {string} navigation.menus[].items[].label - Item label
 * @property {string} navigation.menus[].items[].path - Item path
 * @property {string} navigation.menus[].items[].object - Related object
 *
 * @property {Object} api - Module API surface
 * @property {string} api.namespace - API namespace (e.g., /api/v1/crm)
 * @property {Array<Object>} api.endpoints - API endpoints
 * @property {string} api.endpoints[].method - HTTP method (GET, POST, PUT, DELETE)
 * @property {string} api.endpoints[].path - Endpoint path
 * @property {string} api.endpoints[].description - Endpoint description
 * @property {string} api.endpoints[].object - Related object (if any)
 * @property {string} api.endpoints[].operation - Operation type (list, create, read, update, delete, search)
 * @property {Array<Object>} api.relationships - Cross-object relationship endpoints
 * @property {string} api.relationships[].fromObject - Source object
 * @property {string} api.relationships[].toObject - Target object
 * @property {string} api.relationships[].relationshipName - Relationship name
 * @property {string} api.relationships[].path - Relationship endpoint path
 *
 * @property {Object} documentation - Module documentation
 * @property {string} documentation.overview - Module overview description
 * @property {Array<Object>} documentation.objects - Object documentation
 * @property {string} documentation.objects[].name - Object name
 * @property {string} documentation.objects[].description - Object description
 * @property {Array<string>} documentation.objects[].routes - Object routes
 * @property {Array<string>} documentation.objects[].apis - Object APIs
 * @property {string} documentation.permissions - Permissions documentation
 * @property {string} documentation.capabilities - Capabilities documentation
 *
 * @property {Object} dashboard - Module dashboard contract
 * @property {string} dashboard.id - Dashboard identifier
 * @property {string} dashboard.name - Dashboard display name
 * @property {Object} dashboard.layout - Dashboard layout definition
 * @property {Array<Object>} dashboard.layout.sections - Dashboard sections
 * @property {string} dashboard.layout.sections[].id - Section identifier
 * @property {string} dashboard.layout.sections[].type - Section type (summary, objects, activity, alerts, actions, insights)
 * @property {string} dashboard.layout.sections[].title - Section title
 * @property {Array<Object>} dashboard.layout.sections[].cards - Cards in section
 * @property {Array<Object>} dashboard.widgets - Dashboard widgets
 * @property {string} dashboard.widgets[].id - Widget identifier
 * @property {string} dashboard.widgets[].type - Widget type (quickstats, chart, list, stream)
 * @property {string} dashboard.widgets[].title - Widget title
 * @property {Object} dashboard.widgets[].dataSource - Data source configuration
 * @property {Array<Object>} dashboard.dataConnections - Data connections for real-time updates
 * @property {Object} dashboard.permissions - Dashboard-level permissions
 *
 * @property {Object} workflow - Module workflow contracts
 * @property {string} workflow.module - Module identifier
 * @property {string} workflow.version - Workflow version
 * @property {Array<Object>} workflow.workflows - Workflow definitions
 * @property {string} workflow.workflows[].id - Workflow identifier
 * @property {string} workflow.workflows[].name - Workflow name
 * @property {string} workflow.workflows[].type - Workflow type (primary, lifecycle, approval, cross-object, event-triggered)
 * @property {string} workflow.workflows[].description - Workflow description
 * @property {string} workflow.workflows[].object - Associated object (if any)
 * @property {string} workflow.workflows[].trigger - Trigger type (manual, automatic, event)
 * @property {Array<Object>} workflow.workflows[].steps - Workflow steps
 * @property {string} workflow.workflows[].steps[].id - Step identifier
 * @property {string} workflow.workflows[].steps[].name - Step name
 * @property {string} workflow.workflows[].steps[].action - Action to perform
 * @property {Array<string>} workflow.workflows[].steps[].requiredRoles - Roles that can execute step
 * @property {Object} workflow.workflows[].stateMachine - State machine definition (for lifecycle workflows)
 * @property {Array<Object>} workflow.workflows[].stateMachine.states - State definitions
 * @property {Array<Object>} workflow.workflows[].stateMachine.transitions - State transitions
 * @property {Object} workflow.roleActions - Role-based action definitions
 * @property {string} workflow.roleActions[].role - Role name
 * @property {string} workflow.roleActions[].description - Role description
 * @property {Array<string>} workflow.roleActions[].actions - Allowed actions
 * @property {Array<Object>} workflow.roleActions[].workflows - Workflows available to role
 * @property {Array<Object>} workflow.hooks - Event-triggered hooks
 * @property {string} workflow.hooks[].id - Hook identifier
 * @property {string} workflow.hooks[].event - Event that triggers hook
 * @property {string} workflow.hooks[].namespace - Event namespace
 * @property {Array<Object>} workflow.hooks[].handlers - Event handlers
 *
 * @property {Object} automation - Module automation contracts
 * @property {string} automation.module - Module identifier
 * @property {string} automation.version - Automation version
 * @property {Array<Object>} automation.automations - Automation definitions
 * @property {string} automation.automations[].id - Automation identifier
 * @property {string} automation.automations[].name - Automation name
 * @property {string} automation.automations[].type - Automation type (event-triggered, lifecycle-triggered, approval-triggered, scheduled, exception)
 * @property {string} automation.automations[].description - Automation description
 * @property {Object} automation.automations[].trigger - Trigger configuration
 * @property {string} automation.automations[].trigger.type - Trigger type (event, state-transition, approval-event, schedule, error, data-quality)
 * @property {Array<Object>} automation.automations[].actions - Actions to execute
 * @property {string} automation.automations[].priority - Priority level (critical, high, normal, low)
 * @property {boolean} automation.automations[].enabled - Whether automation is enabled
 * @property {Object} automation.hooks - Notification and integration hooks
 * @property {Object} automation.hooks.notifications - Notification hooks by type
 * @property {Object} automation.hooks.integrations - Integration hooks by system
 * @property {Array<Object>} automation.policies - Automation policies and rules
 *
 * @property {Object} aiAgent - Module AI agent contracts (Phase 14)
 * @property {string} aiAgent.module - Module identifier
 * @property {string} aiAgent.version - AI agent contract version
 * @property {Array<Object>} aiAgent.agents - AI agent definitions
 * @property {string} aiAgent.agents[].id - Agent identifier
 * @property {string} aiAgent.agents[].name - Agent display name
 * @property {string} aiAgent.agents[].type - Agent type (module-primary, object-specialist)
 * @property {string} aiAgent.agents[].description - Agent description
 * @property {Object} aiAgent.agents[].scope - Agent scope and boundaries
 * @property {string} aiAgent.agents[].scope.moduleId - Module identifier
 * @property {Array<string>} aiAgent.agents[].scope.ownedObjects - Objects agent can manage
 * @property {Array<Object>} aiAgent.agents[].ownedObjects - Owned object definitions
 * @property {Array<Object>} aiAgent.agents[].allowedActions - Actions agent can perform
 * @property {Array<Object>} aiAgent.agents[].forbiddenActions - Actions agent cannot perform
 * @property {Object} aiAgent.agents[].permissions - Permission requirements
 * @property {Array<string>} aiAgent.agents[].permissions.minRequiredRoles - Minimum roles required
 * @property {Array<Object>} aiAgent.agents[].assistedWorkflows - Workflows agent can assist with
 * @property {Array<Object>} aiAgent.agents[].triggerableAutomations - Automations agent can trigger
 * @property {Array<Object>} aiAgent.agents[].requiresApproval - Actions requiring approval
 * @property {Object} aiAgent.agents[].safetyConstraints - Safety boundaries
 * @property {boolean} aiAgent.agents[].safetyConstraints.canCreate - Can create objects
 * @property {boolean} aiAgent.agents[].safetyConstraints.canUpdate - Can update objects
 * @property {boolean} aiAgent.agents[].safetyConstraints.canDelete - Can delete objects (always false)
 * @property {Array<string>} aiAgent.agents[].safetyConstraints.requiresExplicitApproval - Actions requiring approval
 * @property {Array<string>} aiAgent.agents[].safetyConstraints.mustLog - Actions that must be logged
 * @property {Object} aiAgent.agents[].errorHandling - Error handling configuration
 * @property {string} aiAgent.agents[].errorHandling.onValidationError - Validation error handling
 * @property {string} aiAgent.agents[].errorHandling.onPermissionDenied - Permission error handling
 * @property {string} aiAgent.agents[].errorHandling.onExternalAPIError - External API error handling
 * @property {Array<string>} aiAgent.agents[].knowledgeReferences - Knowledge base references
 * @property {boolean} aiAgent.agents[].enabled - Whether agent is enabled
 * @property {Object} aiAgent.agentCapabilities - Aggregated agent capabilities
 * @property {number} aiAgent.agentCapabilities.objectManagement - Number of objects managed
 * @property {number} aiAgent.agentCapabilities.workflowAssistance - Number of workflows supported
 * @property {number} aiAgent.agentCapabilities.automationTriggering - Number of triggerable automations
 * @property {Object} aiAgent.permissionModel - Permission model for agents
 * @property {Array<string>} aiAgent.permissionModel.roles - Available roles
 * @property {Object} aiAgent.permissionModel.permissions - Role permissions
 * @property {Object} aiAgent.escalationRules - Escalation rules for agent operations
 * @property {Array<Object>} aiAgent.knowledgeSources - Knowledge sources for agent reasoning
 * @property {Object} aiAgent.constraints - Operational constraints
 */

export {};
