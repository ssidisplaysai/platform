/**
 * RESTContractRenderer
 *
 * Generates REST API contract documentation from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint.api.rest
 * Produces: REST endpoint contracts in Markdown
 *
 * @module tools/genesis/compiler/renderers/RESTContractRenderer.mjs
 */

/**
 * Generate REST contract documentation from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated REST contract documentation
 */
export function generateRESTContract(blueprint) {
  const entityName = blueprint.metadata.entity;
  const pluralName = blueprint.metadata.pluralName;
  const baseRoute = `/api/${entityName.toLowerCase()}`;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  const validation = blueprint.validation;
  const permissions = blueprint.permissions;
  const lifecycle = blueprint.lifecycle;

  const lines = [];

  // Title
  lines.push(`# ${entityName} REST API`);
  lines.push('');
  lines.push(`Base URL: \`${baseRoute}\``);
  lines.push('');

  // Authentication
  lines.push('## Authentication');
  lines.push('All requests require authentication via Bearer token:');
  lines.push('');
  lines.push('```');
  lines.push('Authorization: Bearer <token>');
  lines.push('```');
  lines.push('');

  // Content Type
  lines.push('## Content Type');
  lines.push('All requests and responses use JSON:');
  lines.push('```');
  lines.push('Content-Type: application/json');
  lines.push('```');
  lines.push('');

  // Create endpoint
  lines.push('## POST - Create');
  lines.push('');
  lines.push(`**Endpoint:** \`POST ${baseRoute}\``);
  lines.push('');
  lines.push('**Description:** Create a new ' + entityName);
  lines.push('');
  lines.push('**Request Body:**');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.generated || field.readOnly) continue;
    const comma = i < fields.length - 1 ? ',' : '';
    lines.push(`  "${field.name}": ${getJSONExample(field)}${comma}`);
  }
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('**Response (201 Created):**');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "id": "550e8400-e29b-41d4-a716-446655440000",');
  for (const field of fields) {
    lines.push(`  "${field.name}": ${getJSONExample(field)},`);
  }
  lines.push('  "createdAt": "2026-07-07T12:00:00Z",');
  lines.push('  "updatedAt": "2026-07-07T12:00:00Z"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // Get by ID endpoint
  lines.push('## GET - Read by ID');
  lines.push('');
  lines.push(`**Endpoint:** \`GET ${baseRoute}/:id\``);
  lines.push('');
  lines.push('**Description:** Get a specific ' + entityName);
  lines.push('');
  lines.push('**Path Parameters:**');
  lines.push('');
  lines.push('| Parameter | Type | Description |');
  lines.push('|-----------|------|-------------|');
  lines.push('| id | UUID | Entity ID |');
  lines.push('');
  lines.push('**Response (200 OK):**');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "id": "550e8400-e29b-41d4-a716-446655440000",');
  for (const field of fields) {
    lines.push(`  "${field.name}": ${getJSONExample(field)},`);
  }
  lines.push('  "createdAt": "2026-07-07T12:00:00Z",');
  lines.push('  "updatedAt": "2026-07-07T12:00:00Z"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // List endpoint
  lines.push('## GET - List');
  lines.push('');
  lines.push(`**Endpoint:** \`GET ${baseRoute}\``);
  lines.push('');
  lines.push('**Description:** List all ' + pluralName);
  lines.push('');
  lines.push('**Query Parameters:**');
  lines.push('');
  lines.push('| Parameter | Type | Default | Description |');
  lines.push('|-----------|------|---------|-------------|');
  lines.push('| filter | object | {} | Filter criteria (field=value) |');
  lines.push('| sort | string | createdAt | Sort field |');
  lines.push('| order | string | asc | Sort order (asc/desc) |');
  lines.push('| limit | integer | 20 | Results per page |');
  lines.push('| offset | integer | 0 | Results to skip |');
  lines.push('');
  lines.push('**Response (200 OK):**');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "data": [');
  lines.push('    {');
  lines.push('      "id": "550e8400-e29b-41d4-a716-446655440000",');
  for (const field of fields) {
    lines.push(`      "${field.name}": ${getJSONExample(field)},`);
  }
  lines.push('      "createdAt": "2026-07-07T12:00:00Z",');
  lines.push('      "updatedAt": "2026-07-07T12:00:00Z"');
  lines.push('    }');
  lines.push('  ],');
  lines.push('  "total": 100,');
  lines.push('  "limit": 20,');
  lines.push('  "offset": 0');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // Update endpoint
  lines.push('## PUT - Update');
  lines.push('');
  lines.push(`**Endpoint:** \`PUT ${baseRoute}/:id\``);
  lines.push('');
  lines.push('**Description:** Update a ' + entityName);
  lines.push('');
  lines.push('**Path Parameters:**');
  lines.push('');
  lines.push('| Parameter | Type | Description |');
  lines.push('|-----------|------|-------------|');
  lines.push('| id | UUID | Entity ID |');
  lines.push('');
  lines.push('**Request Body:** Same as Create (all fields optional)');
  lines.push('');
  lines.push('**Response (200 OK):** Same as Create');
  lines.push('');

  // Delete endpoint
  lines.push('## DELETE - Delete');
  lines.push('');
  lines.push(`**Endpoint:** \`DELETE ${baseRoute}/:id\``);
  lines.push('');
  lines.push('**Description:** Delete a ' + entityName);
  lines.push('');
  lines.push('**Path Parameters:**');
  lines.push('');
  lines.push('| Parameter | Type | Description |');
  lines.push('|-----------|------|-------------|');
  lines.push('| id | UUID | Entity ID |');
  lines.push('');
  lines.push('**Response:** 204 No Content');
  lines.push('');

  // Error responses
  lines.push('## Error Responses');
  lines.push('');
  lines.push('### 400 Bad Request');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "BAD_REQUEST",');
  lines.push('  "message": "Invalid request",');
  lines.push('  "errors": [');
  lines.push('    {');
  lines.push('      "field": "email",');
  lines.push('      "message": "Invalid email format"');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('### 401 Unauthorized');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "UNAUTHORIZED",');
  lines.push('  "message": "Authentication required"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('### 403 Forbidden');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "FORBIDDEN",');
  lines.push('  "message": "Insufficient permissions"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('### 404 Not Found');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "NOT_FOUND",');
  lines.push('  "message": "Resource not found"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('### 500 Internal Server Error');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "code": "INTERNAL_ERROR",');
  lines.push('  "message": "An unexpected error occurred"');
  lines.push('}');
  lines.push('```');
  lines.push('');

  // Validation rules
  lines.push('## Validation Rules');
  lines.push('');
  lines.push('| Field | Rule | Message |');
  lines.push('|-------|------|---------|');
  for (const field of fields) {
    if (field.required) {
      lines.push(`| ${field.name} | Required | Must not be empty |`);
    }
    if (field.type === 'email') {
      lines.push(`| ${field.name} | Email format | Must be valid email |`);
    }
    if (field.maxLength) {
      lines.push(`| ${field.name} | Max length ${field.maxLength} | Must not exceed ${field.maxLength} chars |`);
    }
  }
  lines.push('');

  // Permissions
  if (permissions.roles && permissions.roles.length > 0) {
    lines.push('## Permissions');
    lines.push('');
    lines.push('| Role | Create | Read | Update | Delete |');
    lines.push('|------|--------|------|--------|--------|');
    for (const role of permissions.roles) {
      lines.push(`| ${role} | ✓ | ✓ | ✓ | ✓ |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get JSON example for field type
 * @param {Object} field - Field definition
 * @returns {string} JSON example value
 */
function getJSONExample(field) {
  switch (field.type) {
    case 'string':
      return '"example string"';
    case 'email':
      return '"user@example.com"';
    case 'number':
      return '42.5';
    case 'integer':
      return '42';
    case 'boolean':
      return 'true';
    case 'date':
      return '"2026-07-07"';
    case 'timestamp':
      return '"2026-07-07T12:00:00Z"';
    case 'enum':
      const values = field.values || [];
      return `"${values[0] || 'VALUE'}"`;
    case 'identifier':
      return '"550e8400-e29b-41d4-a716-446655440000"';
    default:
      return 'null';
  }
}
