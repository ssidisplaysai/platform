/**
 * RepositoryRenderer
 *
 * Generates repository/data access layer code from EnterpriseObjectBlueprint.
 * Creates finder methods, query builders, and database operations.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Repository class
 *
 * @module tools/genesis/compiler/renderers/RepositoryRenderer
 */

/**
 * Generate repository class code
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript repository code
 */
export function generateRepository(blueprint) {
  const entityName = blueprint.metadata.entity;
  const camelCase = blueprint.api.camelCase;
  const tableName = blueprint.repository.tableName;
  const searchableFields = blueprint.search?.fields?.searchable || [];
  const filterableFields = blueprint.search?.fields?.filterable || [];
  const sortableFields = blueprint.search?.fields?.sortable || [];
  const uniqueFields = blueprint.fields.unique;

  let code = '';
  code += '/**\n';
  code += ` * ${entityName}Repository\n`;
  code += ' *\n';
  code += ` * Data access layer for ${entityName} entities.\n`;
  code += ' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.\n';
  code += ' *\n';
  code += ' * @generated true\n';
  code += ' */\n';
  code += '\n';
  code += `import { Database } from '../infrastructure/database';\n`;
  code += `import { ${entityName} } from '../domain/entities/${entityName}';\n`;
  code += '\n';
  code += `export class ${entityName}Repository {\n`;
  code += '  private db: Database;\n';
  code += '\n';
  code += '  constructor(db: Database) {\n';
  code += '    this.db = db;\n';
  code += '  }\n';
  code += '\n';
  code += '  /**\n';
  code += `   * Find ${entityName} by ID\n`;
  code += '   * @param id - Entity ID\n';
  code += `   * @returns ${entityName} or null if not found\n`;
  code += '   */\n';
  code += '  async findById(id: string): Promise<' + entityName + ' | null> {\n';
  code += `    const result = await this.db.query(\n`;
  code += `      'SELECT * FROM ${tableName} WHERE id = ? AND deleted_at IS NULL',\n`;
  code += `      [id]\n`;
  code += `    );\n`;
  code += '    return result[0] || null;\n';
  code += '  }\n';
  code += '\n';
  code += '  /**\n';
  code += `   * Find all ${entityName} entities\n`;
  code += '   * @param limit - Limit results\n';
  code += '   * @param offset - Offset for pagination\n';
  code += `   * @returns Array of ${entityName}\n`;
  code += '   */\n';
  code += `  async findAll(limit: number = 100, offset: number = 0): Promise<${entityName}[]> {\n`;
  code += `    return await this.db.query(\n`;
  code += `      'SELECT * FROM ${tableName} WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',\n`;
  code += `      [limit, offset]\n`;
  code += `    );\n`;
  code += '  }\n';

  // Add unique field finders
  for (const field of uniqueFields) {
    const methodName = `findBy${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`;
    const fieldType = toTypeScriptType(field.type);
    code += '\n';
    code += '  /**\n';
    code += `   * Find ${entityName} by ${field.name}\n`;
    code += `   * @param ${field.name} - ${field.description || field.name}\n`;
    code += `   * @returns ${entityName} or null if not found\n`;
    code += '   */\n';
    code += `  async ${methodName}(${field.name}: ${fieldType}): Promise<${entityName} | null> {\n`;
    code += `    const result = await this.db.query(\n`;
    code += `      'SELECT * FROM ${tableName} WHERE ${field.name} = ? AND deleted_at IS NULL',\n`;
    code += `      [${field.name}]\n`;
    code += `    );\n`;
    code += '    return result[0] || null;\n';
    code += '  }\n';
  }

  // Add search method if enabled
  if (blueprint.search?.enabled && searchableFields.length > 0) {
    const whereClause = searchableFields.map(f => `${tableName}.${f} LIKE ?`).join(' OR ');
    code += '\n';
    code += '  /**\n';
    code += `   * Search ${entityName} entities\n`;
    code += '   * Searches across: ' + searchableFields.join(', ') + '\n';
    code += '   * @param query - Search query string\n';
    code += '   * @param limit - Limit results\n';
    code += `   * @returns Array of matching ${entityName}\n`;
    code += '   */\n';
    code += `  async search(query: string, limit: number = 50): Promise<${entityName}[]> {\n`;
    code += `    const searchPattern = '%' + query + '%';\n`;
    code += `    return await this.db.query(\n`;
    code += `      'SELECT * FROM ${tableName} WHERE (${whereClause}) AND deleted_at IS NULL LIMIT ?',\n`;
    code += `      [${searchableFields.map(() => 'searchPattern').join(', ')}, limit]\n`;
    code += `    );\n`;
    code += '  }\n';
  }

  // Add filter methods if filterable fields exist
  if (filterableFields.length > 0) {
    code += '\n';
    code += '  /**\n';
    code += `   * Filter ${entityName} entities\n`;
    code += '   * Filters by: ' + filterableFields.join(', ') + '\n';
    code += '   * @param filters - Filter criteria\n';
    code += `   * @returns Array of filtered ${entityName}\n`;
    code += '   */\n';
    code += `  async filter(filters: Record<string, any>): Promise<${entityName}[]> {\n`;
    code += `    const whereConditions = Object.keys(filters)\n`;
    code += `      .map(key => \`\${key} = ?\`)\n`;
    code += `      .join(' AND ');\n`;
    code += `    const values = Object.values(filters);\n`;
    code += `    return await this.db.query(\n`;
    code += `      'SELECT * FROM ${tableName} WHERE \${whereConditions} AND deleted_at IS NULL',\n`;
    code += `      values\n`;
    code += `    );\n`;
    code += '  }\n';
  }

  // Add sort methods if sortable fields exist
  if (sortableFields.length > 0) {
    code += '\n';
    code += '  /**\n';
    code += `   * Get all ${entityName} sorted\n`;
    code += '   * Sortable fields: ' + sortableFields.join(', ') + '\n';
    code += '   * @param sortBy - Field to sort by\n';
    code += '   * @param order - Sort order (asc/desc)\n';
    code += '   * @param limit - Limit results\n';
    code += `   * @returns Sorted ${entityName}\n`;
    code += '   */\n';
    code += `  async findAllSorted(sortBy: string = '${blueprint.search?.defaultSort || 'id'}', order: 'asc' | 'desc' = '${blueprint.search?.defaultSortOrder || 'asc'}', limit: number = 100): Promise<${entityName}[]> {\n`;
    code += `    const validSortFields = [${sortableFields.map(f => `'${f}'`).join(', ')}];\n`;
    code += `    if (!validSortFields.includes(sortBy)) sortBy = '${blueprint.search?.defaultSort || 'id'}';\n`;
    code += `    return await this.db.query(\n`;
    code += `      'SELECT * FROM ${tableName} WHERE deleted_at IS NULL ORDER BY \${sortBy} \${order.toUpperCase()} LIMIT ?',\n`;
    code += `      [limit]\n`;
    code += `    );\n`;
    code += '  }\n';
  }

  // Add relationship loading methods
  for (const rel of blueprint.relationships.belongsTo) {
    const methodName = `${rel.getterMethod}`;
    const returnType = rel.target;
    code += '\n';
    code += '  /**\n';
    code += `   * Load ${rel.target} related to this ${entityName}\n`;
    code += `   * @param ${camelCase} - ${entityName} instance or ID\n`;
    code += `   * @returns ${returnType} or null if not found\n`;
    code += '   */\n';
    code += `  async ${methodName}(${camelCase}: ${entityName} | string): Promise<${returnType} | null> {\n`;
    code += `    const id = typeof ${camelCase} === 'string' ? ${camelCase} : ${camelCase}.id;\n`;
    code += `    const entity = await this.findById(id);\n`;
    code += `    if (!entity || !entity.${rel.name}Id) return null;\n`;
    code += `    // Note: Actual implementation would use related repository\n`;
    code += `    return null; // Placeholder\n`;
    code += '  }\n';
  }

  // Add reverse relationship methods (hasMany)
  for (const rel of blueprint.relationships.hasMany) {
    const methodName = `get${rel.singularName.charAt(0).toUpperCase() + rel.singularName.slice(1).toLowerCase()}s`;
    const returnType = `${rel.target}[]`;
    code += '\n';
    code += '  /**\n';
    code += `   * Load ${rel.target} entities related to this ${entityName}\n`;
    code += `   * @param ${camelCase} - ${entityName} instance or ID\n`;
    code += `   * @returns Array of ${rel.target} entities\n`;
    code += '   */\n';
    code += `  async ${methodName}(${camelCase}: ${entityName} | string): Promise<${returnType}> {\n`;
    code += `    const id = typeof ${camelCase} === 'string' ? ${camelCase} : ${camelCase}.id;\n`;
    code += `    // Note: Actual implementation would query via relationship foreign key\n`;
    code += `    return [];\n`;
    code += '  }\n';
  }

  // Add count method
  code += '\n';
  code += '  /**\n';
  code += `   * Count ${entityName} entities\n`;
  code += `   * @returns Total count of non-deleted ${entityName}\n`;
  code += '   */\n';
  code += '  async count(): Promise<number> {\n';
  code += `    const result = await this.db.query(\n`;
  code += `      'SELECT COUNT(*) as count FROM ${tableName} WHERE deleted_at IS NULL'\n`;
  code += `    );\n`;
  code += '    return result[0]?.count || 0;\n';
  code += '  }\n';

  // Add exists method
  code += '\n';
  code += '  /**\n';
  code += `   * Check if ${entityName} exists\n`;
  code += '   * @param id - Entity ID\n';
  code += `   * @returns true if entity exists and is not deleted\n`;
  code += '   */\n';
  code += '  async exists(id: string): Promise<boolean> {\n';
  code += '    const entity = await this.findById(id);\n';
  code += '    return entity !== null;\n';
  code += '  }\n';

  // Add create method
  code += '\n';
  code += '  /**\n';
  code += `   * Create ${entityName}\n`;
  code += '   * @param data - Entity data\n';
  code += `   * @returns Created ${entityName}\n`;
  code += '   */\n';
  code += `  async create(data: Partial<${entityName}>): Promise<${entityName}> {\n`;
  code += '    const now = new Date().toISOString();\n';
  code += '    const entity = {\n';
  code += '      ...data,\n';
  code += '      created_at: now,\n';
  code += '      updated_at: now,\n';
  code += '    };\n';
  code += `    const result = await this.db.insert('${tableName}', entity);\n`;
  code += `    return { ...entity, id: result.insertId } as ${entityName};\n`;
  code += '  }\n';

  // Add update method
  code += '\n';
  code += '  /**\n';
  code += `   * Update ${entityName}\n`;
  code += '   * @param id - Entity ID\n';
  code += '   * @param data - Partial entity data\n';
  code += `   * @returns Updated ${entityName}\n`;
  code += '   */\n';
  code += `  async update(id: string, data: Partial<${entityName}>): Promise<${entityName}> {\n`;
  code += '    const now = new Date().toISOString();\n';
  code += '    const updates = { ...data, updated_at: now };\n';
  code += `    await this.db.update('${tableName}', updates, { id });\n`;
  code += `    return (await this.findById(id))!;\n`;
  code += '  }\n';

  // Add delete method
  code += '\n';
  code += '  /**\n';
  code += `   * Delete ${entityName} (soft delete)\n`;
  code += '   * @param id - Entity ID\n';
  code += '   */\n';
  code += '  async delete(id: string): Promise<void> {\n';
  code += `    await this.db.update('${tableName}', { deleted_at: new Date().toISOString() }, { id });\n`;
  code += '  }\n';

  // Add hard delete method
  code += '\n';
  code += '  /**\n';
  code += `   * Permanently delete ${entityName}\n`;
  code += '   * @param id - Entity ID\n';
  code += '   */\n';
  code += '  async hardDelete(id: string): Promise<void> {\n';
  code += `    await this.db.delete('${tableName}', { id });\n`;
  code += '  }\n';
  code += '}\n';

  return code;
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert field type to TypeScript type
 * @param {string} fieldType - Field type
 * @returns {string} TypeScript type
 */
function toTypeScriptType(fieldType) {
  const typeMap = {
    identifier: 'string',
    string: 'string',
    email: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    timestamp: 'Date',
    date: 'Date',
    enum: 'string',
    uuid: 'string',
  };
  return typeMap[fieldType] || 'any';
}
