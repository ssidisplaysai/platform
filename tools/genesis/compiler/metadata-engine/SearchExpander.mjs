/**
 * SearchExpander
 *
 * Expands search metadata into a comprehensive search configuration model.
 * Identifies searchable, filterable, sortable, indexed fields and generates
 * search strategies for enterprise objects.
 *
 * Metadata-driven approach: All search behavior derived from YAML, no entity-specific logic.
 *
 * @module tools/genesis/compiler/metadata-engine/SearchExpander
 */

/**
 * Generic field types that support different search strategies
 */
export const SEARCHABLE_FIELD_TYPES = ['string', 'email', 'text', 'identifier'];
export const FILTERABLE_FIELD_TYPES = ['enum', 'boolean', 'status', 'state'];
export const SORTABLE_FIELD_TYPES = ['string', 'number', 'timestamp', 'date', 'boolean'];
export const EXACT_MATCH_FIELD_TYPES = ['email', 'identifier', 'code'];
export const DATE_RANGE_FIELD_TYPES = ['timestamp', 'date'];
export const NUMERIC_RANGE_FIELD_TYPES = ['number', 'decimal', 'currency'];

/**
 * Search index strategies
 */
export const INDEX_STRATEGIES = {
  FULL_TEXT: 'full-text',
  KEYWORD: 'keyword',
  EXACT: 'exact',
  RANGE: 'range',
};

/**
 * Expand search metadata from entity definition
 * @param {Object} searchMetadata - Search capability from entity YAML
 * @param {Array<Object>} fields - Expanded field definitions
 * @param {Object} lifecycle - Lifecycle configuration
 * @param {Array<Object>} relationships - Expanded relationships
 * @returns {Object} Expanded search configuration
 */
export function expandSearch(searchMetadata, fields, lifecycle, relationships) {
  const search = {
    enabled: false,
    indexed: false,
    fullText: false,
    fields: {
      searchable: [],      // String fields for keyword search
      filterable: [],      // Enum/status fields for filtering
      sortable: [],        // All searchable + numeric + date fields
      keywordFields: [],   // Fields included in full-text search
      exactMatchFields: [], // Fields requiring exact match
      dateRangeFields: [], // Fields supporting date range queries
      numericRangeFields: [], // Fields supporting numeric range queries
    },
    lifecycleFilterable: false,
    softDeleteFilterable: false,
    relationshipSearch: [],
    defaultSort: null,
    defaultSortOrder: 'asc',
  };

  // Exit early if search not enabled
  if (!searchMetadata || searchMetadata.enabled !== true) {
    return search;
  }

  search.enabled = true;
  search.indexed = searchMetadata.indexed === true;
  search.fullText = searchMetadata.fullText === true;

  // Build a map of field names and types for quick lookup
  const fieldMap = {};
  if (Array.isArray(fields)) {
    fields.forEach(field => {
      fieldMap[field.name] = field;
    });
  }

  // Check if search has explicit field list from YAML
  const explicitSearchFields = searchMetadata.fields || [];

  // Analyze fields for search capabilities
  if (Array.isArray(fields)) {
    fields.forEach(field => {
      // Field marked as searchable in YAML (individual field attribute)
      const isFieldSearchable = field.searchable === true;
      // Field listed in capabilities.search.fields
      const isInSearchList = explicitSearchFields.includes(field.name);

      // Searchable fields (string/email/text/identifier)
      if ((isFieldSearchable || isInSearchList) && SEARCHABLE_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.searchable.includes(field.name)) {
          search.fields.searchable.push(field.name);
        }
        if (search.fullText) {
          if (!search.fields.keywordFields.includes(field.name)) {
            search.fields.keywordFields.push(field.name);
          }
        }
      }

      // Exact match fields (email, identifier, code)
      if (EXACT_MATCH_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.exactMatchFields.includes(field.name)) {
          search.fields.exactMatchFields.push(field.name);
        }
      }

      // Filterable fields (enum/boolean/status)
      if (FILTERABLE_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.filterable.includes(field.name)) {
          search.fields.filterable.push(field.name);
        }
      }

      // Sortable fields
      if ((isFieldSearchable || isInSearchList || FILTERABLE_FIELD_TYPES.includes(field.type)) && 
          SORTABLE_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.sortable.includes(field.name)) {
          search.fields.sortable.push(field.name);
        }
      }

      // Date range fields
      if (DATE_RANGE_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.dateRangeFields.includes(field.name)) {
          search.fields.dateRangeFields.push(field.name);
        }
        if (!search.fields.sortable.includes(field.name)) {
          search.fields.sortable.push(field.name);
        }
      }

      // Numeric range fields
      if (NUMERIC_RANGE_FIELD_TYPES.includes(field.type)) {
        if (!search.fields.numericRangeFields.includes(field.name)) {
          search.fields.numericRangeFields.push(field.name);
        }
        if (!search.fields.sortable.includes(field.name)) {
          search.fields.sortable.push(field.name);
        }
      }

      // Set default sort if primary/name field
      if ((field.name === 'name' || field.name === 'title') && !search.defaultSort) {
        search.defaultSort = field.name;
      }
    });
  }

  // Lifecycle filtering
  search.lifecycleFilterable = lifecycle && Object.keys(lifecycle.states || {}).length > 0;

  // Soft delete filtering
  search.softDeleteFilterable = lifecycle && lifecycle.softDelete === true;

  // Relationship search (first-level relationships only)
  if (Array.isArray(relationships)) {
    relationships.forEach(rel => {
      if (rel.type === 'ManyToOne' || rel.type === 'OneToOne') {
        search.relationshipSearch.push({
          name: rel.name,
          target: rel.target,
          type: rel.type,
        });
      }
    });
  }

  // Override defaults from metadata if provided
  if (searchMetadata.defaultSort) {
    search.defaultSort = searchMetadata.defaultSort;
  }

  if (searchMetadata.defaultSortOrder) {
    search.defaultSortOrder = searchMetadata.defaultSortOrder;
  }

  return search;
}

/**
 * Get searchable field names
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Searchable field names
 */
export function getSearchableFields(searchConfig) {
  return searchConfig.fields?.searchable || [];
}

/**
 * Get filterable field names
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Filterable field names
 */
export function getFilterableFields(searchConfig) {
  return searchConfig.fields?.filterable || [];
}

/**
 * Get sortable field names
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Sortable field names
 */
export function getSortableFields(searchConfig) {
  return searchConfig.fields?.sortable || [];
}

/**
 * Get keyword/full-text search fields
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Full-text searchable fields
 */
export function getKeywordFields(searchConfig) {
  return searchConfig.fields?.keywordFields || [];
}

/**
 * Get exact match fields
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Exact match field names
 */
export function getExactMatchFields(searchConfig) {
  return searchConfig.fields?.exactMatchFields || [];
}

/**
 * Get date range query fields
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Date range field names
 */
export function getDateRangeFields(searchConfig) {
  return searchConfig.fields?.dateRangeFields || [];
}

/**
 * Get numeric range query fields
 * @param {Object} searchConfig - Expanded search configuration
 * @returns {Array<string>} Numeric range field names
 */
export function getNumericRangeFields(searchConfig) {
  return searchConfig.fields?.numericRangeFields || [];
}

/**
 * Determine if a field should be indexed
 * @param {Object} fieldDef - Field definition
 * @returns {boolean} Whether field should be indexed
 */
export function shouldIndexField(fieldDef) {
  return fieldDef.searchable === true ||
    EXACT_MATCH_FIELD_TYPES.includes(fieldDef.type) ||
    FILTERABLE_FIELD_TYPES.includes(fieldDef.type);
}

/**
 * Get all searchable field configurations
 * @param {Array<Object>} fields - Field definitions
 * @returns {Array<Object>} Searchable fields with metadata
 */
export function getSearchFieldMetadata(fields) {
  return fields
    .filter(f => shouldIndexField(f))
    .map(f => ({
      name: f.name,
      type: f.type,
      indexStrategy: getIndexStrategy(f),
      sortable: SORTABLE_FIELD_TYPES.includes(f.type),
      filterable: FILTERABLE_FIELD_TYPES.includes(f.type),
    }));
}

/**
 * Determine the best index strategy for a field
 * @param {Object} fieldDef - Field definition
 * @returns {string} Index strategy
 */
export function getIndexStrategy(fieldDef) {
  if (EXACT_MATCH_FIELD_TYPES.includes(fieldDef.type)) {
    return INDEX_STRATEGIES.EXACT;
  }
  if (DATE_RANGE_FIELD_TYPES.includes(fieldDef.type) || NUMERIC_RANGE_FIELD_TYPES.includes(fieldDef.type)) {
    return INDEX_STRATEGIES.RANGE;
  }
  if (fieldDef.type === 'string' || fieldDef.type === 'text') {
    return INDEX_STRATEGIES.FULL_TEXT;
  }
  return INDEX_STRATEGIES.KEYWORD;
}
