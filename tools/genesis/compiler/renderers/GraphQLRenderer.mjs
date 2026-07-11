/**
 * GraphQLRenderer
 *
 * Generates GraphQL schema from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint.api.graphQL
 * Produces: GraphQL schema definition
 *
 * @module tools/genesis/compiler/renderers/GraphQLRenderer.mjs
 */

/**
 * Generate GraphQL schema from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated GraphQL schema
 */
export function generateGraphQL(blueprint) {
  const entityName = blueprint.metadata.entity;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  const validation = blueprint.validation;
  const lifecycle = blueprint.lifecycle;

  const lines = [];

  // Type definition
  lines.push(`type ${entityName} {`);
  lines.push('  id: ID!');

  for (const field of fields) {
    if (field.generated) continue;
    lines.push(`  ${field.name}: ${fieldToGraphQLType(field)}${field.required ? '!' : ''}`);
  }

  // Add relationships
  for (const rel of relationships) {
    if (rel.type === 'hasMany' || rel.type === 'manyToMany') {
      lines.push(`  ${rel.name}: [${rel.target}!]!`);
    } else {
      lines.push(`  ${rel.name}: ${rel.target}`);
    }
  }

  lines.push('  createdAt: DateTime!');
  lines.push('  updatedAt: DateTime!');
  lines.push('  createdBy: String');
  lines.push('  updatedBy: String');
  lines.push('}');
  lines.push('');

  // Input types
  lines.push(`input ${entityName}Input {`);
  for (const field of fields) {
    if (field.generated || field.readOnly) continue;
    lines.push(`  ${field.name}: ${fieldToGraphQLType(field)}${field.required ? '!' : ''}`);
  }
  lines.push('}');
  lines.push('');

  // Filter type
  lines.push(`input ${entityName}Filter {`);
  for (const field of fields) {
    if (field.generated) continue;
    const baseType = fieldToGraphQLType(field);
    lines.push(`  ${field.name}: ${baseType}`);
  }
  if (lifecycle.enabled) {
    lines.push('  status: String');
  }
  lines.push('}');
  lines.push('');

  // Queries
  lines.push('type Query {');
  const camelCase = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const pluralName = camelCase + 's';
  lines.push(`  ${camelCase}(id: ID!): ${entityName}`);
  lines.push(`  ${pluralName}(filter: ${entityName}Filter, limit: Int, offset: Int): [${entityName}!]!`);
  lines.push('}');
  lines.push('');

  // Mutations
  lines.push('type Mutation {');
  lines.push(`  create${entityName}(input: ${entityName}Input!): ${entityName}!`);
  lines.push(`  update${entityName}(id: ID!, input: ${entityName}Input!): ${entityName}!`);
  lines.push(`  delete${entityName}(id: ID!): Boolean!`);
  if (lifecycle.softDelete) {
    lines.push(`  softDelete${entityName}(id: ID!): ${entityName}!`);
    lines.push(`  restore${entityName}(id: ID!): ${entityName}!`);
  }
  if (lifecycle.archived) {
    lines.push(`  archive${entityName}(id: ID!): ${entityName}!`);
  }
  lines.push('}');
  lines.push('');

  // Scalar types
  lines.push('scalar DateTime');
  lines.push('');

  // Schema
  lines.push('schema {');
  lines.push('  query: Query');
  lines.push('  mutation: Mutation');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Convert field type to GraphQL type
 * @param {Object} field - Field definition
 * @returns {string} GraphQL type
 */
function fieldToGraphQLType(field) {
  let baseType;

  switch (field.type) {
    case 'string':
    case 'email':
      baseType = 'String';
      break;
    case 'number':
      baseType = 'Float';
      break;
    case 'integer':
      baseType = 'Int';
      break;
    case 'boolean':
      baseType = 'Boolean';
      break;
    case 'date':
    case 'timestamp':
      baseType = 'DateTime';
      break;
    case 'enum':
      baseType = 'String';
      break;
    case 'identifier':
      baseType = 'ID';
      break;
    default:
      baseType = 'String';
  }

  return baseType;
}
