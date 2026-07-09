/**
 * ServiceRenderer
 *
 * Generates service/business logic code from entity metadata.
 * Creates CRUD methods respecting lifecycle, capabilities, and permissions.
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Service class
 *
 * @module tools/genesis/compiler/renderers/ServiceRenderer
 */

/**
 * Generate service class code
 * @param {Object|string} blueprint - EnterpriseObjectBlueprint or (legacy) entityName
 * @param {Array<Object>} fields - (legacy) Expanded field definitions
 * @param {Object} capabilities - (legacy) Expanded capabilities
 * @param {Object} lifecycle - (legacy) Expanded lifecycle
 * @returns {string} Generated TypeScript service code
 */
export function generateService(blueprint, fields, capabilities, lifecycle) {
  // Support both old and new signatures
  let entityName, serviceFields, serviceCapabilities, serviceLifecycle;
  
  if (typeof blueprint === 'string') {
    // Old signature: generateService(entityName, fields, capabilities, lifecycle)
    entityName = blueprint;
    serviceFields = fields || [];
    serviceCapabilities = capabilities || {};
    serviceLifecycle = lifecycle || { states: {} };
  } else {
    // New signature: generateService(blueprint)
    entityName = blueprint.metadata.entity;
    serviceFields = blueprint.fields.all || [];
    serviceCapabilities = blueprint.capabilities || {};
    serviceLifecycle = blueprint.lifecycle || { states: {} };
  }

  return _generateServiceCode(entityName, serviceFields, serviceCapabilities, serviceLifecycle);
}

/**
 * Generate service implementation
 * @private
 */
function _generateServiceCode(entityName, fields, capabilities, lifecycle) {
  const camelCase = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const repositoryName = `${entityName}Repository`;

  const lines = [
    `/**`,
    ` * ${entityName}Service`,
    ` *`,
    ` * Business logic layer for ${entityName} entities.`,
    ` * Handles CRUD operations, validation, and lifecycle management.`,
    ` * Auto-generated from entity metadata.`,
    ` *`,
    ` * @generated true`,
    ` */`,
    ``,
    `import { ${repositoryName} } from '../repositories/${repositoryName}';`,
    `import { ${entityName} } from '../domain/entities/${entityName}';`,
    `import { ${entityName}Validator } from '../validators/${entityName}Validator';`,
    `import { AuditService } from '../infrastructure/audit/AuditService';`,
    ``,
    `export class ${entityName}Service {`,
    `  private repository: ${repositoryName};`,
    `  private validator: ${entityName}Validator;`,
    `  private audit: AuditService;`,
    ``,
    `  constructor(`,
    `    repository: ${repositoryName},`,
    `    validator: ${entityName}Validator,`,
    `    audit: AuditService`,
    `  ) {`,
    `    this.repository = repository;`,
    `    this.validator = validator;`,
    `    this.audit = audit;`,
    `  }`,
    ``,
    `  /**`,
    `   * Get ${entityName} by ID`,
    `   * @param id - Entity ID`,
    `   * @returns ${entityName} with full related data`,
    `   * @throws Error if not found`,
    `   */`,
    `  async get(id: string): Promise<${entityName}> {`,
    `    const entity = await this.repository.findById(id);`,
    `    if (!entity) {`,
    `      throw new Error(\`${entityName} not found: \${id}\`);`,
    `    }`,
    `    return entity;`,
    `  }`,
    ``,
    `  /**`,
    `   * List all ${entityName} entities`,
    `   * @param limit - Limit results`,
    `   * @param offset - Offset for pagination`,
    `   * @returns Array of ${entityName}`,
    `   */`,
    `  async list(limit: number = 100, offset: number = 0): Promise<${entityName}[]> {`,
    `    return await this.repository.findAll(limit, offset);`,
    `  }`,
    ``,
    `  /**`,
    `   * Create new ${entityName}`,
    `   * @param input - Input data`,
    `   * @param context - Request context with user info`,
    `   * @returns Created ${entityName}`,
    `   * @throws Error if validation fails`,
    `   */`,
    `  async create(input: Partial<${entityName}>, context: any): Promise<${entityName}> {`,
    `    // Validate input`,
    `    const validation = await this.validator.validate(input);`,
    `    if (!validation.isValid) {`,
    `      throw new Error(\`Validation failed: \${validation.errors.join(', ')}\`);`,
    `    }`,
    ``,
    `    // Set initial state`,
    `    const entity: any = {`,
    `      ...input,`,
    `      status: '${getInitialStatus(lifecycle)}',`,
    `    };`,
    ``,
    `    // Create in repository`,
    `    const created = await this.repository.create(entity);`,
    ``,
  ];

  // Add audit logging if enabled
  if (capabilities.audit && capabilities.audit.enabled) {
    lines.push(
      `    // Log audit event`,
      `    await this.audit.log({`,
      `      entity: '${entityName}',`,
      `      entityId: created.id,`,
      `      action: 'CREATE',`,
      `      userId: context?.user?.id,`,
      `      changes: created,`,
      `      timestamp: new Date(),`,
      `    });`,
    );
  }

  lines.push(
    ``,
    `    return created;`,
    `  }`,
    ``,
    `  /**`,
    `   * Update ${entityName}`,
    `   * @param id - Entity ID`,
    `   * @param input - Partial input data`,
    `   * @param context - Request context with user info`,
    `   * @returns Updated ${entityName}`,
    `   * @throws Error if validation fails or not found`,
    `   */`,
    `  async update(id: string, input: Partial<${entityName}>, context: any): Promise<${entityName}> {`,
    `    const existing = await this.get(id);`,
    ``,
    `    // Validate update`,
    `    const merged = { ...existing, ...input };`,
    `    const validation = await this.validator.validate(merged);`,
    `    if (!validation.isValid) {`,
    `      throw new Error(\`Validation failed: \${validation.errors.join(', ')}\`);`,
    `    }`,
    ``,
    `    const updated = await this.repository.update(id, input);`,
    ``,
  );

  if (capabilities.audit && capabilities.audit.enabled) {
    lines.push(
      `    // Log audit event`,
      `    await this.audit.log({`,
      `      entity: '${entityName}',`,
      `      entityId: id,`,
      `      action: 'UPDATE',`,
      `      userId: context?.user?.id,`,
      `      changes: input,`,
      `      timestamp: new Date(),`,
      `    });`,
    );
  }

  lines.push(
    ``,
    `    return updated;`,
    `  }`,
    ``,
    `  /**`,
    `   * Delete ${entityName} (soft delete)`,
    `   * @param id - Entity ID`,
    `   * @param context - Request context with user info`,
    `   */`,
    `  async delete(id: string, context: any): Promise<void> {`,
    `    const existing = await this.get(id);`,
    ``,
  );

  if (capabilities.audit && capabilities.audit.enabled) {
    lines.push(
      `    // Log audit event`,
      `    await this.audit.log({`,
      `      entity: '${entityName}',`,
      `      entityId: id,`,
      `      action: 'DELETE',`,
      `      userId: context?.user?.id,`,
      `      timestamp: new Date(),`,
      `    });`,
    );
  }

  lines.push(
    ``,
    `    await this.repository.delete(id);`,
    `  }`,
    ``,
    `  /**`,
    `   * Count total ${entityName} entities`,
    `   * @returns Total count`,
    `   */`,
    `  async count(): Promise<number> {`,
    `    return await this.repository.count();`,
    `  }`,
  );

  // Add lifecycle transition methods if entity has states
  if (lifecycle && lifecycle.transitions && lifecycle.transitions.length > 0) {
    const validTransitionsJSON = JSON.stringify(
      lifecycle.transitions.map(t => ({ from: t.from, to: t.to }))
    );

    lines.push(
      `  // === Lifecycle Management ===`,
      ``,
      `  /**`,
      `   * Check if transition is allowed from current state`,
      `   * @param id - Entity ID`,
      `   * @param toState - Target state`,
      `   * @returns true if transition is valid`,
      `   */`,
      `  async canTransitionTo(id: string, toState: string): Promise<boolean> {`,
      `    const entity = await this.get(id);`,
      `    const currentStatus = (entity as any).status || '${lifecycle.initial || 'DRAFT'}';`,
      `    const validTransitions = ${validTransitionsJSON};`,
      `    return validTransitions.some(`,
      `      t => t.from === currentStatus && t.to === toState`,
      `    );`,
      `  }`,
      ``,
      `  /**`,
      `   * Perform state transition`,
      `   * @param id - Entity ID`,
      `   * @param toState - Target state`,
      `   * @param context - Request context with user info`,
      `   * @returns Updated ${entityName} with new state`,
      `   * @throws Error if transition not allowed`,
      `   */`,
      `  async transitionTo(id: string, toState: string, context: any): Promise<${entityName}> {`,
      `    const entity = await this.get(id);`,
      `    const currentStatus = (entity as any).status || '${lifecycle.initial || 'DRAFT'}';`,
      ``,
      `    // Check if transition is valid`,
      `    const canTransition = await this.canTransitionTo(id, toState);`,
      `    if (!canTransition) {`,
      `      throw new Error(\`Cannot transition from \${currentStatus} to \${toState}\`);`,
      `    }`,
      ``,
      `    // Update status`,
      `    const updated = await this.repository.update(id, { status: toState } as any);`,
      ``,
      `    // Emit lifecycle event if enabled`,
      `    if (context?.eventBus) {`,
      `      context.eventBus.emit('${camelCase}.stateChanged', {`,
      `        entityId: id,`,
      `        fromState: currentStatus,`,
      `        toState: toState,`,
      `        timestamp: new Date(),`,
      `        userId: context?.user?.id,`,
      `      });`,
      `    }`,
      ``,
      `    return updated;`,
      `  }`,
    );

    // Add convenience transition methods for each transition
    const uniqueTransitions = new Map();
    lifecycle.transitions.forEach(t => {
      uniqueTransitions.set(t.to, t);
    });

    for (const [toState, transition] of uniqueTransitions.entries()) {
      const methodName = toState.toLowerCase();
      lines.push(
        ``,
        `  /**`,
        `   * Transition to ${toState}`,
        `   * @param id - Entity ID`,
        `   * @param context - Request context`,
        `   * @returns Updated ${entityName}`,
        `   */`,
        `  async ${methodName}(id: string, context: any): Promise<${entityName}> {`,
        `    return await this.transitionTo(id, '${toState}', context);`,
        `  }`,
      );
    }
  }

  lines.push(
    `}`,
  );

  return lines.join('\n');
}

/**
 * Get initial status based on lifecycle
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {string} Initial status
 */
function getInitialStatus(lifecycle) {
  if (!lifecycle || !lifecycle.states) {
    return 'ACTIVE';
  }
  const states = Object.keys(lifecycle.states);
  // Default to ACTIVE if available, else first state
  return states.includes('ACTIVE') ? 'ACTIVE' : states[0];
}
