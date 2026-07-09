/**
 * IndexExpander
 *
 * Expands search index metadata into a concrete index strategy model.
 * Determines which fields to index, what type of index to use, and
 * how to optimize index configuration for search performance.
 *
 * Metadata-driven approach: All index behavior derived from YAML, no entity-specific logic.
 *
 * @module tools/genesis/compiler/metadata-engine/IndexExpander
 */

/**
 * Index types
 */
export const INDEX_TYPES = {
  STANDARD: 'standard',
  FULL_TEXT: 'full-text',
  EXACT: 'exact-match',
  RANGE: 'range-query',
  COMPOSITE: 'composite',
};

/**
 * Index strategies for different field types
 */
export const FIELD_INDEX_STRATEGIES = {
  string: { type: INDEX_TYPES.FULL_TEXT, analyzer: 'standard' },
  text: { type: INDEX_TYPES.FULL_TEXT, analyzer: 'standard' },
  email: { type: INDEX_TYPES.EXACT, analyzer: 'keyword' },
  identifier: { type: INDEX_TYPES.EXACT, analyzer: 'keyword' },
  code: { type: INDEX_TYPES.EXACT, analyzer: 'keyword' },
  number: { type: INDEX_TYPES.RANGE, analyzer: 'numeric' },
  decimal: { type: INDEX_TYPES.RANGE, analyzer: 'numeric' },
  currency: { type: INDEX_TYPES.RANGE, analyzer: 'numeric' },
  timestamp: { type: INDEX_TYPES.RANGE, analyzer: 'date' },
  date: { type: INDEX_TYPES.RANGE, analyzer: 'date' },
  boolean: { type: INDEX_TYPES.STANDARD, analyzer: 'keyword' },
  enum: { type: INDEX_TYPES.STANDARD, analyzer: 'keyword' },
  status: { type: INDEX_TYPES.STANDARD, analyzer: 'keyword' },
  state: { type: INDEX_TYPES.STANDARD, analyzer: 'keyword' },
};

/**
 * Expand index configuration from entity metadata
 * @param {Object} searchMetadata - Search capability from entity YAML
 * @param {Array<Object>} fields - Field definitions
 * @param {string} entityName - Entity name for index naming
 * @returns {Object} Expanded index configuration
 */
export function expandIndex(searchMetadata, fields, entityName) {
  const index = {
    enabled: false,
    indexName: '',
    strategy: 'simple',
    fields: [],
    compositeIndexes: [],
    settings: {
      analyzers: [],
      refreshInterval: '1s',
      numberOfShards: 1,
      numberOfReplicas: 0,
    },
  };

  // Exit early if search/indexing not enabled
  if (!searchMetadata || searchMetadata.enabled !== true || searchMetadata.indexed !== true) {
    return index;
  }

  index.enabled = true;
  index.indexName = `${entityName.toLowerCase()}_index`;

  // Determine index strategy based on search metadata
  if (searchMetadata.fullText) {
    index.strategy = 'full-text';
  } else if (searchMetadata.indexed === true) {
    index.strategy = 'simple';
  }

  // Analyze fields for indexing
  if (Array.isArray(fields)) {
    fields.forEach(field => {
      // Index searchable fields
      if (field.searchable === true || isHighValueField(field)) {
        const indexConfig = createFieldIndexConfig(field);
        index.fields.push(indexConfig);

        // Track analyzers needed
        if (indexConfig.analyzer && !index.settings.analyzers.includes(indexConfig.analyzer)) {
          index.settings.analyzers.push(indexConfig.analyzer);
        }
      }
    });
  }

  // Define composite indexes for common query patterns
  index.compositeIndexes = generateCompositeIndexes(fields, entityName);

  return index;
}

/**
 * Check if a field is high-value for indexing
 * @param {Object} fieldDef - Field definition
 * @returns {boolean} Whether field is important to index
 */
function isHighValueField(fieldDef) {
  const highValueTypes = ['identifier', 'email', 'code', 'status', 'state', 'enum'];
  const highValueNames = ['id', 'name', 'status', 'state', 'code', 'email'];

  return highValueTypes.includes(fieldDef.type) ||
    highValueNames.includes(fieldDef.name) ||
    fieldDef.unique === true;
}

/**
 * Create index configuration for a field
 * @param {Object} fieldDef - Field definition
 * @returns {Object} Index configuration for field
 */
function createFieldIndexConfig(fieldDef) {
  const strategy = FIELD_INDEX_STRATEGIES[fieldDef.type] || FIELD_INDEX_STRATEGIES.string;

  return {
    name: fieldDef.name,
    type: fieldDef.type,
    indexType: strategy.type,
    analyzer: strategy.analyzer,
    sortable: isSortableType(fieldDef.type),
    filterable: isFilterableType(fieldDef.type),
    required: fieldDef.required === true,
    unique: fieldDef.unique === true,
  };
}

/**
 * Check if field type is sortable
 * @param {string} fieldType - Field type
 * @returns {boolean} Whether type is sortable
 */
function isSortableType(fieldType) {
  const sortableTypes = ['string', 'number', 'timestamp', 'date', 'boolean', 'enum'];
  return sortableTypes.includes(fieldType);
}

/**
 * Check if field type is filterable
 * @param {string} fieldType - Field type
 * @returns {boolean} Whether type is filterable
 */
function isFilterableType(fieldType) {
  const filterableTypes = ['enum', 'boolean', 'status', 'state'];
  return filterableTypes.includes(fieldType);
}

/**
 * Generate composite indexes for common query patterns
 * @param {Array<Object>} fields - Field definitions
 * @param {string} entityName - Entity name
 * @returns {Array<Object>} Composite index definitions
 */
function generateCompositeIndexes(fields, entityName) {
  const composites = [];

  // Always create status + date index for common queries
  const statusField = fields.find(f => f.type === 'enum' || f.type === 'status');
  const dateField = fields.find(f => f.type === 'timestamp' || f.type === 'date');

  if (statusField && dateField) {
    composites.push({
      name: `${entityName.toLowerCase()}_status_date_idx`,
      fields: [statusField.name, dateField.name],
      type: 'composite',
    });
  }

  // Create composite for searchable fields if multiple exist
  const searchableFields = fields
    .filter(f => f.searchable === true && (f.type === 'string' || f.type === 'text'))
    .map(f => f.name);

  if (searchableFields.length > 1) {
    composites.push({
      name: `${entityName.toLowerCase()}_search_idx`,
      fields: searchableFields.slice(0, 3), // Limit to 3 fields
      type: 'composite',
    });
  }

  return composites;
}

/**
 * Get indexed field names
 * @param {Object} indexConfig - Expanded index configuration
 * @returns {Array<string>} Indexed field names
 */
export function getIndexedFields(indexConfig) {
  return indexConfig.fields?.map(f => f.name) || [];
}

/**
 * Get sortable indexed fields
 * @param {Object} indexConfig - Expanded index configuration
 * @returns {Array<string>} Sortable field names
 */
export function getSortableIndexedFields(indexConfig) {
  return indexConfig.fields
    ?.filter(f => f.sortable === true)
    .map(f => f.name) || [];
}

/**
 * Get filterable indexed fields
 * @param {Object} indexConfig - Expanded index configuration
 * @returns {Array<string>} Filterable field names
 */
export function getFilterableIndexedFields(indexConfig) {
  return indexConfig.fields
    ?.filter(f => f.filterable === true)
    .map(f => f.name) || [];
}

/**
 * Get composite indexes
 * @param {Object} indexConfig - Expanded index configuration
 * @returns {Array<Object>} Composite index definitions
 */
export function getCompositeIndexes(indexConfig) {
  return indexConfig.compositeIndexes || [];
}

/**
 * Generate analyzer configurations for index
 * @param {Object} indexConfig - Expanded index configuration
 * @returns {Array<Object>} Analyzer configurations
 */
export function getAnalyzerConfigs(indexConfig) {
  const analyzers = [
    {
      name: 'standard',
      type: 'standard',
      stopwords: '_english_',
    },
    {
      name: 'keyword',
      type: 'keyword',
    },
    {
      name: 'numeric',
      type: 'numeric',
    },
    {
      name: 'date',
      type: 'date',
    },
  ];

  // Return only analyzers that are actually used
  return analyzers.filter(a => indexConfig.settings.analyzers.includes(a.name));
}

/**
 * Get search query templates based on index configuration
 * @param {Object} indexConfig - Expanded index configuration
 * @param {Array<string>} searchableFields - Searchable field names
 * @returns {Object} Query templates
 */
export function getQueryTemplates(indexConfig, searchableFields) {
  return {
    simple: {
      type: 'match',
      fields: searchableFields,
    },
    advanced: {
      type: 'bool',
      must: [],
      filter: [],
      should: [],
    },
    aggregations: {
      facets: indexConfig.fields
        ?.filter(f => f.filterable === true)
        .map(f => f.name) || [],
    },
  };
}
