/**
 * EventsRenderer
 *
 * Generates event definitions and emission logic from EnterpriseObjectBlueprint.
 * Events are emitted when entity lifecycle events occur (created, updated, deleted, etc).
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Events class
 *
 * @module tools/genesis/compiler/renderers/EventsRenderer
 */

/**
 * Generate events class code
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript events code
 */
export function generateEvents(blueprint) {
  const entityName = blueprint.metadata.entity;
  const camelCase = blueprint.api.camelCase;
  const requiresAudit = blueprint.capabilities.audit.enabled;
  const hasLifecycle = blueprint.lifecycle && blueprint.lifecycle.states && Object.keys(blueprint.lifecycle.states).length > 0;
  const events = blueprint.events || {};
  const stateTransitionEvents = (events.lifecycle || []).filter(e => e.category === 'state-transition');

  let code = '';
  code += '/**\n';
  code += ` * ${entityName}Events\n`;
  code += ' *\n';
  code += ` * Event definitions and emitters for ${entityName} lifecycle.\n`;
  code += ' * Entities emit events on creation, update, deletion, and state transitions.\n';
  code += ' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.\n';
  code += ' *\n';
  code += ' * @generated true\n';
  code += ' */\n';
  code += '\n';
  code += '// Event types\n';
  code += `export const ${entityName}EventTypes = {\n`;
  code += `  CREATED: '${camelCase}.created',\n`;
  code += `  UPDATED: '${camelCase}.updated',\n`;
  code += `  DELETED: '${camelCase}.deleted',\n`;
  code += `  RESTORED: '${camelCase}.restored',\n`;
  if (hasLifecycle) {
    code += `  STATE_CHANGED: '${camelCase}.stateChanged',\n`;
    // Add state transition event types
    for (const event of stateTransitionEvents) {
      const constName = event.toState ? `TO_${event.toState}` : event.name.toUpperCase();
      code += `  STATE_${constName}: '${camelCase}.state.${event.toState ? event.toState.toLowerCase() : event.name.toLowerCase()}',\n`;
    }
  }
  if (requiresAudit) {
    code += `  AUDITED: '${camelCase}.audited',\n`;
  }
  code += '};\n';

  // Event payload types
  code += '\n';
  code += '// Event payloads\n';
  code += `export interface ${entityName}CreatedEvent {\n`;
  code += `  type: string;\n`;
  code += `  entityId: string;\n`;
  code += `  entity: any;\n`;
  code += `  timestamp: Date;\n`;
  code += `  userId?: string;\n`;
  code += '}\n';

  code += '\n';
  code += `export interface ${entityName}UpdatedEvent {\n`;
  code += `  type: string;\n`;
  code += `  entityId: string;\n`;
  code += `  changes: Record<string, any>;\n`;
  code += `  timestamp: Date;\n`;
  code += `  userId?: string;\n`;
  code += '}\n';

  code += '\n';
  code += `export interface ${entityName}DeletedEvent {\n`;
  code += `  type: string;\n`;
  code += `  entityId: string;\n`;
  code += `  softDelete: boolean;\n`;
  code += `  timestamp: Date;\n`;
  code += `  userId?: string;\n`;
  code += '}\n';

  if (hasLifecycle) {
    code += '\n';
    code += `export interface ${entityName}StateChangedEvent {\n`;
    code += `  type: string;\n`;
    code += `  entityId: string;\n`;
    code += `  fromState: string;\n`;
    code += `  toState: string;\n`;
    code += `  trigger: string;\n`;
    code += `  timestamp: Date;\n`;
    code += `  userId?: string;\n`;
    code += '}\n';
  }

  // Event emitter class
  code += '\n';
  code += `export class ${entityName}EventEmitter {\n`;
  code += '  private listeners: Map<string, Function[]> = new Map();\n';
  code += '\n';
  code += '  /**\n';
  code += '   * Subscribe to an event type\n';
  code += '   * @param eventType - Event type\n';
  code += '   * @param handler - Event handler function\n';
  code += '   */\n';
  code += '  on(eventType: string, handler: Function): void {\n';
  code += '    if (!this.listeners.has(eventType)) {\n';
  code += '      this.listeners.set(eventType, []);\n';
  code += '    }\n';
  code += '    this.listeners.get(eventType)!.push(handler);\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Emit an event\n';
  code += '   * @param event - Event object\n';
  code += '   */\n';
  code += '  emit(event: any): void {\n';
  code += '    const handlers = this.listeners.get(event.type) || [];\n';
  code += '    for (const handler of handlers) {\n';
  code += '      try {\n';
  code += '        handler(event);\n';
  code += '      } catch (error) {\n';
  code += '        console.error(`Error handling event ${event.type}:`, error);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Unsubscribe from an event type\n';
  code += '   * @param eventType - Event type\n';
  code += '   * @param handler - Event handler function\n';
  code += '   */\n';
  code += '  off(eventType: string, handler: Function): void {\n';
  code += '    const handlers = this.listeners.get(eventType);\n';
  code += '    if (handlers) {\n';
  code += '      const index = handlers.indexOf(handler);\n';
  code += '      if (index > -1) {\n';
  code += '        handlers.splice(index, 1);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n';

  code += '}\n';

  code += '\n';
  code += '// Global event emitter instance\n';
  code += `export const ${camelCase}Events = new ${entityName}EventEmitter();\n`;

  return code;
}
