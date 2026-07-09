/**
 * OpenAPIRenderer
 *
 * Generates OpenAPI 3.1 contract documentation from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint.api.openAPI
 * Produces: OpenAPI YAML specification
 *
 * @module tools/genesis/compiler/renderers/OpenAPIRenderer.mjs
 */

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
  const validation = blueprint.validation;
  const permissions = blueprint.permissions;
  const lifecycle = blueprint.lifecycle;

  const lines = [];

  // Header
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

  // Main schema
  lines.push(`    ${entityName}:`);
  lines.push('      type: object');
  lines.push('      properties:');
  for (const field of fields) {
    lines.push(`        ${field.name}:`);
    const prop = fieldToOpenAPIProperty(field, validation);
    lines.push(`          type: ${prop.type}`);
    if (prop.format) lines.push(`          format: ${prop.format}`);
    if (prop.maxLength) lines.push(`          maxLength: ${prop.maxLength}`);
    if (prop.enum) lines.push(`          enum: [${prop.enum.map(v => `"${v}"`).join(', ')}]`);
    if (field.description) lines.push(`          description: ${field.description}`);
  }
  lines.push('');

  // Input schema
  lines.push(`    ${entityName}Input:`);
  lines.push('      type: object');
  lines.push('      properties:');
  for (const field of fields) {
    if (field.generated || field.readOnly) continue;
    lines.push(`        ${field.name}:`);
    const prop = fieldToOpenAPIProperty(field, validation);
    lines.push(`          type: ${prop.type}`);
    if (prop.format) lines.push(`          format: ${prop.format}`);
    if (prop.maxLength) lines.push(`          maxLength: ${prop.maxLength}`);
    if (prop.enum) lines.push(`          enum: [${prop.enum.map(v => `"${v}"`).join(', ')}]`);
    if (field.description) lines.push(`          description: ${field.description}`);
  }
  lines.push('');

  // Response schema
  lines.push(`    ${entityName}Response:`);
  lines.push('      type: object');
  lines.push('      properties:');
  for (const field of fields) {
    lines.push(`        ${field.name}:`);
    const prop = fieldToOpenAPIProperty(field, validation);
    lines.push(`          type: ${prop.type}`);
    if (prop.format) lines.push(`          format: ${prop.format}`);
    if (prop.maxLength) lines.push(`          maxLength: ${prop.maxLength}`);
    if (prop.enum) lines.push(`          enum: [${prop.enum.map(v => `"${v}"`).join(', ')}]`);
    if (field.description) lines.push(`          description: ${field.description}`);
  }

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
 * @param {Object} validation - Validation config
 * @returns {Object} OpenAPI property schema
 */
function fieldToOpenAPIProperty(field, validation) {
  const property = {};

  switch (field.type) {
    case 'string':
      property.type = 'string';
      if (field.maxLength) property.maxLength = field.maxLength;
      break;
    case 'email':
      property.type = 'string';
      property.format = 'email';
      break;
    case 'number':
    case 'integer':
      property.type = field.type === 'integer' ? 'integer' : 'number';
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
      property.enum = field.values || [];
      break;
    case 'identifier':
      property.type = 'string';
      property.format = 'uuid';
      break;
    default:
      property.type = 'string';
  }

  return property;
}
