/**
 * FieldExpander
 *
 * Expands raw field metadata into fully specified field definitions.
 * Adds type information, validation rules, and generated properties.
 *
 * @module tools/genesis/compiler/metadata-engine/FieldExpander
 */

/**
 * Expand field metadata with full type information and defaults
 * @param {string} fieldName - Name of field
 * @param {Object} fieldDef - Raw field definition from YAML
 * @returns {Object} Expanded field definition
 */
export function expandField(fieldName, fieldDef) {
  const expanded = {
    name: fieldName,
    type: fieldDef.type,
    description: fieldDef.description || '',
    required: fieldDef.required === true,
    generated: fieldDef.generated === true,
    readonly: fieldDef.readonly === true,
    unique: fieldDef.unique === true,
    searchable: fieldDef.searchable === true,
  };

  // Type-specific properties
  if (fieldDef.type === 'string') {
    expanded.maxLength = fieldDef.maxLength || 255;
    expanded.minLength = fieldDef.minLength || 0;
    expanded.pattern = fieldDef.pattern;
  }

  if (fieldDef.type === 'email') {
    expanded.maxLength = fieldDef.maxLength || 255;
    expanded.pattern = fieldDef.pattern || '^[^@]+@[^@]+\\.[^@]+$';
  }

  if (fieldDef.type === 'enum') {
    expanded.values = fieldDef.values || [];
    expanded.default = fieldDef.default;
  }

  if (fieldDef.type === 'number' || fieldDef.type === 'integer') {
    expanded.min = fieldDef.min;
    expanded.max = fieldDef.max;
  }

  if (fieldDef.type === 'timestamp') {
    expanded.autoUpdate = fieldDef.autoUpdate === true;
  }

  if (fieldDef.type === 'date') {
    expanded.default = fieldDef.default || 'NOW()';
  }

  return expanded;
}

/**
 * Expand all fields from entity metadata
 * @param {Object} fieldsMetadata - Fields object from entity YAML
 * @returns {Array<Object>} Array of expanded field definitions
 */
export function expandAllFields(fieldsMetadata) {
  return Object.entries(fieldsMetadata)
    .map(([name, def]) => expandField(name, def))
    .sort((a, b) => {
      // Generated fields last
      if (a.generated !== b.generated) {
        return a.generated ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Get searchable fields
 * @param {Array<Object>} fields - Expanded fields
 * @param {Object} searchConfig - Search capability config
 * @returns {Array<Object>} Fields that are searchable
 */
export function getSearchableFields(fields, searchConfig) {
  if (!searchConfig || !searchConfig.enabled) {
    return [];
  }

  if (searchConfig.fields && searchConfig.fields.length > 0) {
    return fields.filter(f => searchConfig.fields.includes(f.name));
  }

  // Default: searchable string fields
  return fields.filter(f => 
    (f.type === 'string' || f.type === 'email') && !f.generated
  );
}

/**
 * Get required fields
 * @param {Array<Object>} fields - Expanded fields
 * @returns {Array<Object>} Required fields
 */
export function getRequiredFields(fields) {
  return fields.filter(f => f.required && !f.generated);
}

/**
 * Get unique fields (for database constraints)
 * @param {Array<Object>} fields - Expanded fields
 * @returns {Array<Object>} Unique fields
 */
export function getUniqueFields(fields) {
  return fields.filter(f => f.unique);
}
