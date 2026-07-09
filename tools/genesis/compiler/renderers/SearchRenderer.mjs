/**
 * SearchRenderer
 *
 * Generates search index configuration from EnterpriseObjectBlueprint.
 * Defines which fields are searchable, filterable, sortable and how they should be indexed.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript search configuration and methods
 *
 * @module tools/genesis/compiler/renderers/SearchRenderer
 */

/**
 * Generate search configuration code
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript search configuration
 */
export function generateSearch(blueprint) {
  const entityName = blueprint.metadata.entity;
  const camelCase = blueprint.api.camelCase;
  const search = blueprint.search;
  const index = blueprint.index;

  if (!search.enabled) {
    return generateDisabledSearchConfig(entityName, camelCase);
  }

  let code = '';
  code += '/**\n';
  code += ` * ${entityName}Search\n`;
  code += ' *\n';
  code += ` * Search index configuration for ${entityName} entities.\n`;
  code += ` * Searchable fields: ${search.fields.searchable.join(', ') || 'none'}\n`;
  code += ` * Filterable fields: ${search.fields.filterable.join(', ') || 'none'}\n`;
  code += ` * Sortable fields: ${search.fields.sortable.join(', ') || 'none'}\n`;
  code += ' *\n';
  code += ' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.\n';
  code += ' * @generated true\n';
  code += ' */\n';
  code += '\n';

  // Export search configuration
  code += `export const ${entityName}SearchConfig = {\n`;
  code += `  entity: '${entityName}',\n`;
  code += `  resource: '${camelCase}',\n`;
  code += `  enabled: true,\n`;
  code += `  indexed: ${search.indexed},\n`;
  code += `  fullText: ${search.fullText},\n`;
  code += `  indexName: '${index.indexName || camelCase + '_index'}',\n`;
  code += `  indexStrategy: '${index.strategy}',\n`;
  code += `  searchableFields: [${search.fields.searchable.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  filterableFields: [${search.fields.filterable.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  sortableFields: [${search.fields.sortable.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  keywordFields: [${search.fields.keywordFields.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  exactMatchFields: [${search.fields.exactMatchFields.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  dateRangeFields: [${search.fields.dateRangeFields.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  numericRangeFields: [${search.fields.numericRangeFields.map(f => `'${f}'`).join(', ')}],\n`;
  code += `  defaultSort: '${search.defaultSort || 'id'}',\n`;
  code += `  defaultSortOrder: '${search.defaultSortOrder}',\n`;
  code += `  lifecycleFilterable: ${search.lifecycleFilterable},\n`;
  code += `  softDeleteFilterable: ${search.softDeleteFilterable},\n`;
  code += `  relationshipSearch: ${JSON.stringify(search.relationshipSearch, null, 2).split('\n').join('\n  ')},\n`;
  code += `};\n`;

  code += '\n';
  code += '// Query builder interfaces\n';
  code += 'export interface SearchQuery {\n';
  code += '  query?: string;\n';
  code += '  filters?: Record<string, any>;\n';
  code += '  sort?: { field: string; order: \'asc\' | \'desc\' };\n';
  code += '  limit?: number;\n';
  code += '  offset?: number;\n';
  code += '}\n';

  code += '\n';
  code += 'export interface SearchResult {\n';
  code += `  entity: '${entityName}';\n`;
  code += '  total: number;\n';
  code += '  results: any[];\n';
  code += '  facets?: Record<string, any>;\n';
  code += '}\n';

  code += '\n';
  code += `export class ${entityName}Searcher {\n`;
  code += '  /**\n';
  code += '   * Build a simple keyword search query\n';
  code += '   * Searches across all keyword fields\n';
  code += '   */\n';
  code += '  static buildKeywordQuery(query: string): object {\n';
  code += `    const fields = ${JSON.stringify(search.fields.keywordFields)};\n`;
  code += '    if (fields.length === 0) return {};\n';
  code += '    return {\n';
  code += '      bool: {\n';
  code += '        should: fields.map(field => ({\n';
  code += '          match: { [field]: { query, fuzziness: \'AUTO\' } },\n';
  code += '        })),\n';
  code += '        minimumShouldMatch: 1,\n';
  code += '      },\n';
  code += '    };\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Build an exact match query\n';
  code += '   * Searches across exact match fields only\n';
  code += '   */\n';
  code += '  static buildExactQuery(value: string): object {\n';
  code += `    const fields = ${JSON.stringify(search.fields.exactMatchFields)};\n`;
  code += '    if (fields.length === 0) return {};\n';
  code += '    return {\n';
  code += '      bool: {\n';
  code += '        should: fields.map(field => ({ term: { [field]: value } })),\n';
  code += '        minimumShouldMatch: 1,\n';
  code += '      },\n';
  code += '    };\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Build a filter query\n';
  code += '   * Combines keyword search with filters\n';
  code += '   */\n';
  code += '  static buildFilteredQuery(searchQuery: SearchQuery): object {\n';
  code += '    const query: any = { bool: { must: [], filter: [] } };\n';
  code += '\n';
  code += '    if (searchQuery.query) {\n';
  code += '      query.bool.must.push(this.buildKeywordQuery(searchQuery.query));\n';
  code += '    }\n';
  code += '\n';
  code += '    if (searchQuery.filters) {\n';
  code += '      Object.entries(searchQuery.filters).forEach(([field, value]) => {\n';
  code += '        query.bool.filter.push({ term: { [field]: value } });\n';
  code += '      });\n';
  code += '    }\n';
  code += '\n';
  code += '    return query;\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Build a range query\n';
  code += '   * Supports date and numeric range queries\n';
  code += '   */\n';
  code += '  static buildRangeQuery(field: string, gte?: any, lte?: any): object {\n';
  code += '    const range: any = {};\n';
  code += '    if (gte !== undefined) range.gte = gte;\n';
  code += '    if (lte !== undefined) range.lte = lte;\n';
  code += '    return { range: { [field]: range } };\n';
  code += '  }\n';

  code += '\n';
  code += '  /**\n';
  code += '   * Get the default sort configuration\n';
  code += '   */\n';
  code += '  static getDefaultSort() {\n';
  code += `    return { field: '${search.defaultSort || 'id'}', order: '${search.defaultSortOrder}' };\n`;
  code += '  }\n';

  code += '}\n';

  // Export index configuration if indexed
  if (search.indexed) {
    code += '\n';
    code += '// Index configuration\n';
    code += `export const ${entityName}IndexConfig = {\n`;
    code += `  indexName: '${index.indexName}',\n`;
    code += `  strategy: '${index.strategy}',\n`;
    code += `  fields: ${JSON.stringify(index.fields, null, 2).split('\n').join('\n  ')},\n`;
    code += `  compositeIndexes: ${JSON.stringify(index.compositeIndexes, null, 2).split('\n').join('\n  ')},\n`;
    code += `  settings: ${JSON.stringify(index.settings, null, 2).split('\n').join('\n  ')},\n`;
    code += `};\n`;
  }

  return code;
}

/**
 * Generate a disabled search config placeholder
 * @param {string} entityName - Entity name
 * @param {string} camelCase - Camel case entity name
 * @returns {string} Disabled search configuration
 */
function generateDisabledSearchConfig(entityName, camelCase) {
  let code = '';
  code += '/**\n';
  code += ` * ${entityName}Search (Disabled)\n`;
  code += ' *\n';
  code += ` * Search is not enabled for ${entityName} entities.\n`;
  code += ' * @generated true\n';
  code += ' */\n';
  code += '\n';
  code += `export const ${entityName}SearchConfig = {\n`;
  code += `  entity: '${entityName}',\n`;
  code += `  resource: '${camelCase}',\n`;
  code += `  enabled: false,\n`;
  code += `};\n`;

  return code;
}
