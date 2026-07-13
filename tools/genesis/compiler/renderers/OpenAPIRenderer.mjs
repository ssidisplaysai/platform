/**
 * OpenAPIRenderer
 *
 * Generates OpenAPI 3.1 contract documentation from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint
 * Produces: OpenAPI YAML specification
 *
 * Contract:
 * - All enum values normalized at FieldExpander level
 * - Defensive normalization at renderer level
 * - Deterministic field ordering (alphabetical)
 * - Deterministic property enumeration (sorted)
 * - No timestamps in generated content
 * - Safe handling of all metadata edge cases
 *
 * @module tools/genesis/compiler/renderers/OpenAPIRenderer.mjs
 */

// ---------------------------------------------------------------------------
// Normalization Utilities
// ---------------------------------------------------------------------------

/**
 * Normalize enum values to always be a sorted, deduplicated array
 * @param {*} input - Enum input (string, array, undefined, etc.)
 * @returns {string[]} Normalized, sorted enum values
 */
function normalizeEnumValues(input) {
  if (!input) return [];
  
  if (typeof input === 'string') {
    // Handle inline array syntax: "['VALUE1', 'VALUE2']"
    if (input.startsWith('[') && input.endsWith(']')) {
      const parsed = input
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(v => v);
      return Array.from(new Set(parsed)).sort();
    }
    // Single string value
    return [input];
  }
  
  if (Array.isArray(input)) {
    const values = input.map(v => String(v)).filter(v => v);
    return Array.from(new Set(values)).sort();
  }
  
  return [];
}

/**
 * Safely render a field as OpenAPI property
 * @param {Object} field - Field definition
 * @returns {string[]} Lines of YAML property definition
 */
function renderFieldProperty(field) {
  const lines = [];
  const prop = fieldToOpenAPIProperty(field);
  
  if (!prop) return lines;
  
  // Type
  if (prop.type) {
    lines.push(`          type: ${prop.type}`);
  }
  
  // Format
  if (prop.format) {
    lines.push(`          format: ${prop.format}`);
  }
  
  // String constraints
  if (prop.maxLength) {
    lines.push(`          maxLength: ${prop.maxLength}`);
  }
  if (prop.minLength !== undefined && prop.minLength > 0) {
    lines.push(`          minLength: ${prop.minLength}`);
  }
  if (prop.pattern) {
    lines.push(`          pattern: "${prop.pattern}"`);
  }
  
  // Numeric constraints
  if (prop.minimum !== undefined) {
    lines.push(`          minimum: ${prop.minimum}`);
  }
  if (prop.maximum !== undefined) {
    lines.push(`          maximum: ${prop.maximum}`);
  }
  
  // Enum values (always normalized and sorted)
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const enumStr = prop.enum.map(v => `"${v}"`).join(', ');
    lines.push(`          enum: [${enumStr}]`);
  }
  
  // Description
  if (field.description) {
    lines.push(`          description: ${field.description}`);
  }
  
  return lines;
}

// ---------------------------------------------------------------------------
// Main OpenAPI Generator
// ---------------------------------------------------------------------------

/**
 * Generate OpenAPI contract from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated OpenAPI YAML
 */
export function generateOpenAPI(blueprint) {
  const entityName = blueprint.metadata.entity;
  const api = blueprint.api;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;

  const lines = [];

  // Header (no timestamps for determinism)
  lines.push('openapi: 3.1.0');
  lines.push('info:');
  lines.push(`  title: ${entityName} API`);
  lines.push(`  description: API specification for ${entityName} entity`);
  lines.push('  version: 1.0.0');
  lines.push('');

  // Servers
  lines.push('servers:');
  lines.push('  - url: http://localhost:3000');
  lines.push('    description: Development server');
  lines.push('  - url: https://api.example.com');
  lines.push('    description: Production server');
  lines.push('');

  // Paths
  lines.push('paths:');

  // Create endpoint
  lines.push(`  ${api.rest.baseRoute}:`);
  lines.push('    post:');
  lines.push(`      summary: Create ${entityName}`);
  lines.push(`      description: Create a new ${entityName}`);
  lines.push('      tags:');
  lines.push(`        - ${entityName}`);
  lines.push('      requestBody:');
  lines.push('        required: true');
  lines.push('        content:');
  lines.push('          application/json:');
  lines.push(`            schema:`);
  lines.push(`              $ref: '#/components/schemas/${entityName}Input'`);
  lines.push('      responses:');
  lines.push('        "201":');
  lines.push('          description: Created');
  lines.push('          content:');
  lines.push('            application/json:');
  lines.push('              schema:');
  lines.push(`                $ref: '#/components/schemas/${entityName}Response'`);
  lines.push('        "400":');
  lines.push('          description: Bad Request');
  lines.push('        "401":');
  lines.push('          description: Unauthorized');
  lines.push('        "403":');
  lines.push('          description: Forbidden');
  lines.push('');

  // List endpoint
  lines.push('    get:');
  lines.push(`      summary: List ${blueprint.metadata.pluralName}`);
  lines.push(`      description: List all ${blueprint.metadata.pluralName}`);
  lines.push('      tags:');
  lines.push(`        - ${entityName}`);
  lines.push('      parameters:');
  lines.push('        - name: filter');
  lines.push('          in: query');
  lines.push('          description: Filter criteria');
  lines.push('          schema:');
  lines.push('            type: object');
  lines.push('        - name: sort');
  lines.push('          in: query');
  lines.push('          description: Sort field');
  lines.push('          schema:');
  lines.push('            type: string');
  lines.push('        - name: limit');
  lines.push('          in: query');
  lines.push('          description: Number of items to return');
  lines.push('          schema:');
  lines.push('            type: integer');
  lines.push('            default: 20');
  lines.push('        - name: offset');
  lines.push('          in: query');
  lines.push('          description: Number of items to skip');
  lines.push('          schema:');
  lines.push('            type: integer');
  lines.push('            default: 0');
  lines.push('      responses:');
  lines.push('        "200":');
  lines.push('          description: Success');
  lines.push('          content:');
  lines.push('            application/json:');
  lines.push('              schema:');
  lines.push('                type: array');
  lines.push('                items:');
  lines.push(`                  $ref: '#/components/schemas/${entityName}Response'`);
  lines.push('');

  // Get by ID endpoint
  lines.push(`  ${api.rest.baseRoute}/{{id}}:`);
  lines.push('    get:');
  lines.push(`      summary: Get ${entityName} by ID`);
  lines.push(`      description: Get a specific ${entityName}`);
  lines.push('      tags:');
  lines.push(`        - ${entityName}`);
  lines.push('      parameters:');
  lines.push('        - name: id');
  lines.push('          in: path');
  lines.push('          required: true');
  lines.push('          description: Entity ID');
  lines.push('          schema:');
  lines.push('            type: string');
  lines.push('            format: uuid');
  lines.push('      responses:');
  lines.push('        "200":');
  lines.push('          description: Success');
  lines.push('          content:');
  lines.push('            application/json:');
  lines.push('              schema:');
  lines.push(`                $ref: '#/components/schemas/${entityName}Response'`);
  lines.push('        "404":');
  lines.push('          description: Not Found');
  lines.push('');

  // Update endpoint
  lines.push('    put:');
  lines.push(`      summary: Update ${entityName}`);
  lines.push(`      description: Update a ${entityName}`);
  lines.push('      tags:');
  lines.push(`        - ${entityName}`);
  lines.push('      parameters:');
  lines.push('        - name: id');
  lines.push('          in: path');
  lines.push('          required: true');
  lines.push('          schema:');
  lines.push('            type: string');
  lines.push('            format: uuid');
  lines.push('      requestBody:');
  lines.push('        required: true');
  lines.push('        content:');
  lines.push('          application/json:');
  lines.push(`            schema:`);
  lines.push(`              $ref: '#/components/schemas/${entityName}Input'`);
  lines.push('      responses:');
  lines.push('        "200":');
  lines.push('          description: Updated');
  lines.push('          content:');
  lines.push('            application/json:');
  lines.push('              schema:');
  lines.push(`                $ref: '#/components/schemas/${entityName}Response'`);
  lines.push('');

  // Delete endpoint
  lines.push('    delete:');
  lines.push(`      summary: Delete ${entityName}`);
  lines.push(`      description: Delete a ${entityName}`);
  lines.push('      tags:');
  lines.push(`        - ${entityName}`);
  lines.push('      parameters:');
  lines.push('        - name: id');
  lines.push('          in: path');
  lines.push('          required: true');
  lines.push('          schema:');
  lines.push('            type: string');
  lines.push('            format: uuid');
  lines.push('      responses:');
  lines.push('        "204":');
  lines.push('          description: Deleted');
  lines.push('');

  // Components / Schemas
  lines.push('components:');
  lines.push('  schemas:');

  // Main schema - properties in alphabetical order
  lines.push(`    ${entityName}:`);
  lines.push('      type: object');
  lines.push('      properties:');
  
  // Sort fields alphabetically for determinism
  const sortedFields = Array.from(fields).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
  
  for (const field of sortedFields) {
    lines.push(`        ${field.name}:`);
    const propLines = renderFieldProperty(field);
    lines.push(...propLines);
  }
  lines.push('');

  // Input schema - same fields, sorted
  lines.push(`    ${entityName}Input:`);
  lines.push('      type: object');
  lines.push('      properties:');
  
  for (const field of sortedFields) {
    if (field.generated || field.readonly) continue;
    lines.push(`        ${field.name}:`);
    const propLines = renderFieldProperty(field);
    lines.push(...propLines);
  }
  lines.push('');

  // Response schema - same fields, sorted
  lines.push(`    ${entityName}Response:`);
  lines.push('      type: object');
  lines.push('      properties:');
  
  for (const field of sortedFields) {
    lines.push(`        ${field.name}:`);
    const propLines = renderFieldProperty(field);
    lines.push(...propLines);
  }
  lines.push('');
  // Error schema
  lines.push('');
  lines.push('    Error:');
  lines.push('      type: object');
  lines.push('      properties:');
  lines.push('        code:');
  lines.push('          type: string');
  lines.push('        message:');
  lines.push('          type: string');
  lines.push('        details:');
  lines.push('          type: object');

  return lines.join('\n');
}

/**
 * Convert field to OpenAPI property schema
 * @param {Object} field - Field definition
 * @returns {Object} OpenAPI property schema with safe, normalized values
 */
function fieldToOpenAPIProperty(field) {
  if (!field) return {};
  
  const property = {};

  // Type mapping
  switch (field.type) {
    case 'string':
      property.type = 'string';
      if (field.maxLength !== undefined) {
        property.maxLength = field.maxLength;
      }
      if (field.minLength !== undefined && field.minLength > 0) {
        property.minLength = field.minLength;
      }
      if (field.pattern) {
        property.pattern = field.pattern;
      }
      break;
      
    case 'email':
      property.type = 'string';
      property.format = 'email';
      if (field.maxLength !== undefined) {
        property.maxLength = field.maxLength;
      }
      break;
      
    case 'number':
      property.type = 'number';
      if (field.min !== undefined) property.minimum = field.min;
      if (field.max !== undefined) property.maximum = field.max;
      break;
      
    case 'integer':
      property.type = 'integer';
      if (field.min !== undefined) property.minimum = field.min;
      if (field.max !== undefined) property.maximum = field.max;
      break;
      
    case 'boolean':
      property.type = 'boolean';
      break;
      
    case 'date':
      property.type = 'string';
      property.format = 'date';
      break;
      
    case 'timestamp':
      property.type = 'string';
      property.format = 'date-time';
      break;
      
    case 'enum':
      property.type = 'string';
      // Normalize enum values safely
      property.enum = normalizeEnumValues(field.values);
      break;
      
    case 'identifier':
      property.type = 'string';
      property.format = 'uuid';
      break;
      
    case 'array':
      property.type = 'array';
      if (field.itemType) {
        property.items = { type: field.itemType };
      } else {
        property.items = { type: 'string' };
      }
      break;
      
    case 'object':
      property.type = 'object';
      if (field.properties) {
        property.additionalProperties = true;
      }
      break;
      
    default:
      property.type = 'string';
  }

  return property;
}
