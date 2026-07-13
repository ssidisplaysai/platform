/**
 * DTORenderer
 *
 * Generates self-contained, compilable Data Transfer Objects from
 * EnterpriseObjectBlueprint.
 *
 * Contract:
 * - No external imports (no entity classes, no referenced types)
 * - All types defined inline
 * - CreateDto: mutable fields, excludes generated/readonly, includes required creation fields
 * - UpdateDto: all fields optional, excludes generated/readonly/immutable
 * - ReadDto: complete canonical shape, includes readonly, includes system fields
 * - QueryDto: searchable fields only from blueprint.capabilities.search
 * - ListResultDto: deterministic envelope with typed items
 * - Enum fields preserved as string-literal unions
 * - Deterministic field ordering
 * - Byte-for-byte identical output across repeated generation
 *
 * @module tools/genesis/compiler/renderers/DTORenderer.mjs
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function toCamelCase(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

function toTitleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Convert field type to TypeScript type string.
 * Enums are preserved as string-literal unions.
 *
 * @param {Object} field - Field definition
 * @returns {string} TypeScript type
 */
function fieldToTypeScript(field) {
  if (!field || !field.type) return 'unknown';

  switch (field.type) {
    case 'string':
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return 'string';

    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'date':
    case 'timestamp':
    case 'datetime':
      return 'Date';

    case 'enum':
      if (Array.isArray(field.values) && field.values.length > 0) {
        const enumLiterals = field.values.map(v => `'${v}'`).join(' | ');
        return enumLiterals;
      }
      return 'string';

    case 'uuid':
    case 'identifier':
      return 'string';

    case 'object':
    case 'json':
      return 'Record<string, unknown>';

    default:
      return 'unknown';
  }
}

/**
 * Check if field should be included in CreateDto.
 * Excludes generated identifiers, system fields, readonly fields.
 */
function isCreatableField(field) {
  if (!field) return false;
  if (field.generated || field.readOnly || field.systemManaged) return false;
  if (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt') return false;
  if (field.name === 'createdBy' || field.name === 'updatedBy') return false;
  return true;
}

/**
 * Check if field should be included in UpdateDto.
 * Excludes generated, system, readonly, immutable fields.
 */
function isUpdatableField(field) {
  if (!field) return false;
  if (field.generated || field.readOnly || field.systemManaged || field.immutable) return false;
  if (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt') return false;
  if (field.name === 'createdBy' || field.name === 'updatedBy') return false;
  return true;
}

/**
 * Check if field should be included in ReadDto.
 * Includes all public fields (system fields included).
 */
function isReadableField(field) {
  if (!field) return false;
  if (field.internal || field.hidden) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

/**
 * Generate DTO definitions from blueprint.
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript source code
 */
export function generateDTOs(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for DTO generation');
  }

  const entityName = blueprint.metadata.entity;
  const camelEntity = toCamelCase(entityName);

  // Extract data with safe defaults
  const allFields = (blueprint.fields && blueprint.fields.all) ? blueprint.fields.all : [];
  const searchableFieldNames = (blueprint.capabilities && blueprint.capabilities.searchFields) 
    ? blueprint.capabilities.searchFields 
    : [];

  // Sort fields deterministically by name for all DTOs
  const sortedFields = [...allFields].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const L = [];

  // ── File header ────────────────────────────────────────────────────────────
  L.push('/**');
  L.push(' * ' + entityName + ' Data Transfer Objects (DTOs)');
  L.push(' *');
  L.push(' * Type-safe data contracts for ' + entityName + ' API operations.');
  L.push(' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.');
  L.push(' *');
  L.push(' * @generated true');
  L.push(' */');
  L.push('');

  // ── CreateDto ──────────────────────────────────────────────────────────────
  L.push('/** Create payload: mutable fields required for entity creation. */');
  L.push('export interface ' + entityName + 'CreateDto {');
  const creatableFields = sortedFields.filter(isCreatableField);
  if (creatableFields.length === 0) {
    L.push('  // No creatable fields defined');
  } else {
    for (const field of creatableFields) {
      const optional = !field.required ? '?' : '';
      const type = fieldToTypeScript(field);
      L.push('  ' + field.name + optional + ': ' + type + ';');
    }
  }
  L.push('}');
  L.push('');

  // ── UpdateDto ──────────────────────────────────────────────────────────────
  L.push('/** Update payload: all mutable fields optional. */');
  L.push('export interface ' + entityName + 'UpdateDto {');
  const updatableFields = sortedFields.filter(isUpdatableField);
  if (updatableFields.length === 0) {
    L.push('  // No updatable fields defined');
  } else {
    for (const field of updatableFields) {
      const type = fieldToTypeScript(field);
      L.push('  ' + field.name + '?: ' + type + ';');
    }
  }
  L.push('}');
  L.push('');

  // ── ReadDto ────────────────────────────────────────────────────────────────
  L.push('/** Read payload: complete canonical entity shape. */');
  L.push('export interface ' + entityName + 'ReadDto {');
  L.push('  id: string;');
  const readableFields = sortedFields.filter(isReadableField);
  for (const field of readableFields) {
    // Skip fields that are system fields (will be added explicitly)
    if (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt' ||
        field.name === 'createdBy' || field.name === 'updatedBy') {
      continue;
    }
    const optional = !field.required ? '?' : '';
    const readonly = field.readOnly ? 'readonly ' : '';
    const type = fieldToTypeScript(field);
    L.push('  ' + readonly + field.name + optional + ': ' + type + ';');
  }
  L.push('  readonly createdAt: Date;');
  L.push('  readonly updatedAt: Date;');
  L.push('  readonly createdBy?: string;');
  L.push('  readonly updatedBy?: string;');
  L.push('}');
  L.push('');

  // ── QueryDto ───────────────────────────────────────────────────────────────
  L.push('/** Query filter payload: searchable fields only. */');
  L.push('export interface ' + entityName + 'QueryDto {');
  if (searchableFieldNames.length === 0) {
    L.push('  // No searchable fields configured');
  } else {
    // Find searchable fields from all fields
    for (const fieldName of searchableFieldNames.sort()) {
      const field = sortedFields.find(f => f.name === fieldName);
      if (field) {
        const type = fieldToTypeScript(field);
        L.push('  ' + field.name + '?: ' + type + ';');
      }
    }
  }
  L.push('}');
  L.push('');

  // ── ListResultDto ──────────────────────────────────────────────────────────
  L.push('/** Paginated list result envelope. */');
  L.push('export interface ' + entityName + 'ListResultDto {');
  L.push('  /** Array of ' + entityName + ' read objects. */');
  L.push('  readonly items: ' + entityName + 'ReadDto[];');
  L.push('  /** Total count of matching entities (ignoring pagination). */');
  L.push('  readonly total: number;');
  L.push('  /** Number of items per page. */');
  L.push('  readonly pageSize: number;');
  L.push('  /** Current page number (0-indexed). */');
  L.push('  readonly pageNumber: number;');
  L.push('  /** Whether more pages exist. */');
  L.push('  readonly hasNextPage: boolean;');
  L.push('}');
  L.push('');

  // ── Error Response (generic, not entity-specific) ──────────────────────────
  L.push('/** Structured error response. */');
  L.push('export interface ErrorResponseDto {');
  L.push('  code: string;');
  L.push('  message: string;');
  L.push('  timestamp?: Date;');
  L.push('  path?: string;');
  L.push('  details?: Record<string, unknown>;');
  L.push('}');
  L.push('');

  return L.join('\n');
}
