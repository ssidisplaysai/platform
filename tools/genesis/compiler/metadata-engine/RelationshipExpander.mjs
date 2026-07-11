/**
 * RelationshipExpander
 *
 * Expands relationship metadata into typed relationship definitions
 * with proper constraints and operations.
 *
 * @module tools/genesis/compiler/metadata-engine/RelationshipExpander
 */

/**
 * Normalize relationship type names to canonical form
 * @param {string} type - Raw type from YAML (hasMany, OneToMany, ManyToOne, etc.)
 * @returns {string} Canonical type name
 */
function normalizeRelationshipType(type) {
  const typeMap = {
    // New naming convention
    'OneToOne': 'hasOne',
    'OneToMany': 'hasMany',
    'ManyToOne': 'belongsTo',
    'ManyToMany': 'manyToMany',
    // Old naming convention (keep as-is for identity)
    'hasOne': 'hasOne',
    'hasMany': 'hasMany',
    'belongsTo': 'belongsTo',
    'manyToMany': 'manyToMany',
  };
  return typeMap[type] || 'hasMany'; // Default to hasMany
}

/**
 * Expand relationship metadata
 * @param {string} relationshipName - Name of relationship
 * @param {Object} relDef - Raw relationship definition from YAML
 * @returns {Object} Expanded relationship definition
 */
export function expandRelationship(relationshipName, relDef) {
  const canonicalType = normalizeRelationshipType(relDef.type);
  
  const expanded = {
    name: relationshipName,
    type: canonicalType, // hasMany, hasOne, belongsTo, manyToMany
    originalType: relDef.type, // Preserve original type name for documentation
    target: relDef.target, // Target entity name
    description: relDef.description || '',
    required: relDef.required === true,
    cascade: relDef.cascade || false, // Cascade delete/update
    lazyLoad: relDef.lazyLoad !== false, // Default: lazy load (true if not specified)
    lazy: relDef.lazy !== false, // Alias for lazyLoad
    inverse: relDef.inverse, // Name of inverse relationship on target
  };

  // Generate property accessor names
  if (expanded.type === 'hasMany' || expanded.type === 'manyToMany') {
    expanded.pluralName = relationshipName;
    expanded.singularName = relationshipName.replace(/s$/, ''); // Simple singularization
    expanded.getterMethod = `get${capitalize(relationshipName)}`;
    expanded.adderMethod = `add${capitalize(expanded.singularName)}`;
    expanded.removerMethod = `remove${capitalize(expanded.singularName)}`;
  }

  if (expanded.type === 'hasOne' || expanded.type === 'belongsTo') {
    expanded.getterMethod = `get${capitalize(relationshipName)}`;
    expanded.setterMethod = `set${capitalize(relationshipName)}`;
  }

  return expanded;
}

/**
 * Expand all relationships from entity metadata
 * @param {Object} relationshipsMetadata - Relationships object from entity YAML
 * @returns {Array<Object>} Array of expanded relationship definitions
 */
export function expandAllRelationships(relationshipsMetadata) {
  if (!relationshipsMetadata) {
    return [];
  }

  return Object.entries(relationshipsMetadata)
    .map(([name, def]) => expandRelationship(name, def))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get relationships of a specific type
 * @param {Array<Object>} relationships - Expanded relationships
 * @param {string} type - Type filter (hasMany, hasOne, belongsTo, etc.)
 * @returns {Array<Object>} Filtered relationships
 */
export function getRelationshipsByType(relationships, type) {
  return relationships.filter(r => r.type === type);
}

/**
 * Get required relationships
 * @param {Array<Object>} relationships - Expanded relationships
 * @returns {Array<Object>} Required relationships
 */
export function getRequiredRelationships(relationships) {
  return relationships.filter(r => r.required);
}

/**
 * Helper to capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
