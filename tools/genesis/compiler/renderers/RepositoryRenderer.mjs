/**
 * RepositoryRenderer
 *
 * Generates self-contained, compilable repository/data access layer code from
 * EnterpriseObjectBlueprint.
 *
 * All types required by the generated file are declared within the file itself.
 * No imports from non-existent infrastructure or domain modules are emitted.
 * Relationship loader methods (which require external entity types) are omitted.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Repository class
 *
 * CONTRACT GUARANTEES
 * - No imports from modules outside the generated output directory
 * - No references to undefined entity or infrastructure types
 * - All CRUD method signatures are valid under strict TypeScript
 * - Entity record interface derived entirely from blueprint field metadata
 * - DatabaseAdapter interface declared in-file; no external dependency
 * - Deterministic: identical blueprint -> identical byte-for-byte output
 *
 * @module tools/genesis/compiler/renderers/RepositoryRenderer
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function toSnakeCase(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function fieldToTsType(field) {
  switch (field.type) {
    case 'identifier': case 'string': case 'email': case 'text': case 'code': case 'uuid':
      return 'string';
    case 'enum':
      if (Array.isArray(field.values) && field.values.length > 0) {
        return field.values.map(v => "'" + v + "'").join(' | ');
      }
      return 'string';
    case 'number': case 'integer': case 'decimal': case 'currency':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'timestamp': case 'date':
      return 'Date';
    default:
      return 'unknown';
  }
}

function buildRecordInterface(recordName, fields) {
  const lines = [
    '/** Database row shape for ' + recordName.replace('Record', '') + ' entities. */',
    'export interface ' + recordName + ' {',
  ];
  for (const field of fields) {
    if (field.type === 'identifier') {
      lines.push('  id: string;');
    } else {
      lines.push('  ' + field.name + '?: ' + fieldToTsType(field) + ';');
    }
  }
  lines.push('}');
  return lines;
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

export function generateRepository(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for repository generation');
  }

  const entityName = blueprint.metadata.entity;
  const recordName = entityName + 'Record';
  const className = entityName + 'Repository';

  const tableName =
    (blueprint.repository && blueprint.repository.tableName)
      ? blueprint.repository.tableName
      : toSnakeCase(entityName);

  const allFields = (blueprint.fields && blueprint.fields.all) ? blueprint.fields.all : [];
  const uniqueFields = (blueprint.fields && blueprint.fields.unique) ? blueprint.fields.unique : [];

  const searchEnabled = !!(blueprint.search && blueprint.search.enabled);
  const searchableFields =
    (blueprint.search && blueprint.search.fields && Array.isArray(blueprint.search.fields.searchable))
      ? blueprint.search.fields.searchable : [];
  const filterableFields =
    (blueprint.search && blueprint.search.fields && Array.isArray(blueprint.search.fields.filterable))
      ? blueprint.search.fields.filterable : [];
  const sortableFields =
    (blueprint.search && blueprint.search.fields && Array.isArray(blueprint.search.fields.sortable))
      ? blueprint.search.fields.sortable : [];
  const defaultSort = (blueprint.search && blueprint.search.defaultSort) ? blueprint.search.defaultSort : 'id';
  const defaultSortOrder = (blueprint.search && blueprint.search.defaultSortOrder) ? blueprint.search.defaultSortOrder : 'asc';

  const L = [];

  L.push('/**');
  L.push(' * ' + className);
  L.push(' *');
  L.push(' * Data access layer for ' + entityName + ' entities.');
  L.push(' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.');
  L.push(' *');
  L.push(' * @generated true');
  L.push(' */');
  L.push('');

  L.push('/**');
  L.push(' * Minimal database adapter contract.');
  L.push(' * Implement with any database client (pg, mysql2, sqlite3, Prisma, etc.).');
  L.push(' */');
  L.push('export interface DatabaseAdapter {');
  L.push('  query(sql: string, params?: unknown[]): Promise<unknown[]>;');
  L.push('  insert(table: string, data: unknown): Promise<{ insertId: string }>;');
  L.push('  update(table: string, data: unknown, where: unknown): Promise<void>;');
  L.push('  delete(table: string, where: unknown): Promise<void>;');
  L.push('}');
  L.push('');

  for (const line of buildRecordInterface(recordName, allFields)) {
    L.push(line);
  }
  L.push('');

  L.push('export class ' + className + ' {');
  L.push('  private readonly db: DatabaseAdapter;');
  L.push('');
  L.push('  constructor(db: DatabaseAdapter) {');
  L.push('    this.db = db;');
  L.push('  }');
  L.push('');

  L.push('  async findById(id: string): Promise<' + recordName + ' | null> {');
  L.push("    const rows = await this.db.query(");
  L.push("      'SELECT * FROM " + tableName + " WHERE id = ? AND deleted_at IS NULL',");
  L.push('      [id]');
  L.push('    );');
  L.push('    return rows.length > 0 ? rows[0] as ' + recordName + ' : null;');
  L.push('  }');
  L.push('');

  L.push('  async findAll(limit: number = 100, offset: number = 0): Promise<' + recordName + '[]> {');
  L.push('    const rows = await this.db.query(');
  L.push("      'SELECT * FROM " + tableName + " WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',");
  L.push('      [limit, offset]');
  L.push('    );');
  L.push('    return rows as ' + recordName + '[];');
  L.push('  }');
  L.push('');

  for (const field of uniqueFields) {
    if (field.type === 'identifier') continue;
    const methodName = 'findBy' + capitalize(field.name);
    const paramType = fieldToTsType(field);
    L.push('  async ' + methodName + '(' + field.name + ': ' + paramType + '): Promise<' + recordName + ' | null> {');
    L.push('    const rows = await this.db.query(');
    L.push("      'SELECT * FROM " + tableName + " WHERE " + field.name + " = ? AND deleted_at IS NULL',");
    L.push('      [' + field.name + ']');
    L.push('    );');
    L.push('    return rows.length > 0 ? rows[0] as ' + recordName + ' : null;');
    L.push('  }');
    L.push('');
  }

  if (searchEnabled && searchableFields.length > 0) {
    const whereClause = searchableFields.map(f => tableName + '.' + f + ' LIKE ?').join(' OR ');
    const paramList = searchableFields.map(() => 'searchPattern').join(', ');
    L.push('  async search(query: string, limit: number = 50): Promise<' + recordName + '[]> {');
    L.push("    const searchPattern = '%' + query + '%';");
    L.push('    const rows = await this.db.query(');
    L.push("      'SELECT * FROM " + tableName + " WHERE (" + whereClause + ") AND deleted_at IS NULL LIMIT ?',");
    L.push('      [' + paramList + ', limit]');
    L.push('    );');
    L.push('    return rows as ' + recordName + '[];');
    L.push('  }');
    L.push('');
  }

  if (filterableFields.length > 0) {
    L.push('  async filter(filters: Record<string, unknown>): Promise<' + recordName + '[]> {');
    L.push('    const keys = Object.keys(filters);');
    L.push('    if (keys.length === 0) { return this.findAll(); }');
    L.push('    const whereConditions = keys.map(key => `${key} = ?`).join(\' AND \');');
    L.push('    const values = Object.values(filters);');
    L.push('    const rows = await this.db.query(');
    L.push('      `SELECT * FROM ' + tableName + ' WHERE ${whereConditions} AND deleted_at IS NULL`,');
    L.push('      values');
    L.push('    );');
    L.push('    return rows as ' + recordName + '[];');
    L.push('  }');
    L.push('');
  }

  if (sortableFields.length > 0) {
    const sortFieldLiterals = sortableFields.map(f => "'" + f + "'").join(', ');
    L.push('  async findAllSorted(');
    L.push("    sortBy: string = '" + defaultSort + "',");
    L.push("    order: 'asc' | 'desc' = '" + defaultSortOrder + "',");
    L.push('    limit: number = 100');
    L.push('  ): Promise<' + recordName + '[]> {');
    L.push('    const validSortFields: readonly string[] = [' + sortFieldLiterals + '];');
    L.push("    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : '" + defaultSort + "';");
    L.push('    const rows = await this.db.query(');
    L.push('      `SELECT * FROM ' + tableName + ' WHERE deleted_at IS NULL ORDER BY ${safeSortBy} ${order.toUpperCase()} LIMIT ?`,');
    L.push('      [limit]');
    L.push('    );');
    L.push('    return rows as ' + recordName + '[];');
    L.push('  }');
    L.push('');
  }

  L.push('  async count(): Promise<number> {');
  L.push('    const rows = await this.db.query(');
  L.push("      'SELECT COUNT(*) as count FROM " + tableName + " WHERE deleted_at IS NULL'");
  L.push('    );');
  L.push('    if (rows.length === 0) return 0;');
  L.push('    const row = rows[0] as Record<string, unknown>;');
  L.push("    return typeof row['count'] === 'number' ? row['count'] : 0;");
  L.push('  }');
  L.push('');

  L.push('  async exists(id: string): Promise<boolean> {');
  L.push('    return (await this.findById(id)) !== null;');
  L.push('  }');
  L.push('');

  L.push('  async create(data: Partial<' + recordName + '>): Promise<' + recordName + '> {');
  L.push('    const now = new Date().toISOString();');
  L.push('    const row = { ...data, created_at: now, updated_at: now };');
  L.push("    const result = await this.db.insert('" + tableName + "', row);");
  L.push('    return { ...row, id: result.insertId } as unknown as ' + recordName + ';');
  L.push('  }');
  L.push('');

  L.push('  async update(id: string, data: Partial<' + recordName + '>): Promise<' + recordName + '> {');
  L.push('    const now = new Date().toISOString();');
  L.push("    await this.db.update('" + tableName + "', { ...data, updated_at: now }, { id });");
  L.push('    const updated = await this.findById(id);');
  L.push('    if (updated === null) {');
  L.push('      throw new Error(`' + entityName + ' not found after update: ${id}`);');
  L.push('    }');
  L.push('    return updated;');
  L.push('  }');
  L.push('');

  L.push('  async delete(id: string): Promise<void> {');
  L.push("    await this.db.update('" + tableName + "', { deleted_at: new Date().toISOString() }, { id });");
  L.push('  }');
  L.push('');

  L.push('  async hardDelete(id: string): Promise<void> {');
  L.push("    await this.db.delete('" + tableName + "', { id });");
  L.push('  }');

  L.push('}');
  L.push('');

  return L.join('\n');
}
