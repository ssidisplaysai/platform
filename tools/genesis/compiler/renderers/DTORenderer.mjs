/**
 * DTORenderer
 *
 * Generates TypeScript Data Transfer Objects from EnterpriseObjectBlueprint.
 * Consumes: EnterpriseObjectBlueprint.fields, relationships
 * Produces: TypeScript DTO classes
 *
 * @module tools/genesis/compiler/renderers/DTORenderer.mjs
 */

/**
 * Generate DTO classes from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript DTO code
 */
export function generateDTOs(blueprint) {
  const entityName = blueprint.metadata.entity;
  const fields = blueprint.fields.all;
  const relationships = blueprint.relationships.all;
  const validation = blueprint.validation;

  const lines = [];

  // Header
  lines.push('/**');
  lines.push(` * ${entityName} Data Transfer Objects (DTOs)`);
  lines.push(' *');
  lines.push(' * Auto-generated from entity metadata.');
  lines.push(' * DTOs define the shape of data sent to and from the API.');
  lines.push(' *');
  lines.push(' * @generated true');
  lines.push(' */');
  lines.push('');

  // Entity DTO
  lines.push(`export interface ${entityName}DTO {`);
  for (const field of fields) {
    const optional = !field.required ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${fieldToTypeScriptType(field)};`);
  }
  for (const rel of relationships) {
    const type = rel.type === 'hasMany' ? `${rel.target}[]` : rel.target;
    lines.push(`  ${rel.name}?: ${type};`);
  }
  lines.push('}');
  lines.push('');

  // Create Request DTO
  lines.push(`export interface Create${entityName}Request {`);
  for (const field of fields) {
    if (field.generated || field.readOnly) continue;
    const optional = !field.required ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${fieldToTypeScriptType(field)};`);
  }
  lines.push('}');
  lines.push('');

  // Update Request DTO
  lines.push(`export interface Update${entityName}Request {`);
  for (const field of fields) {
    if (field.generated || field.readOnly) continue;
    // Updates make all fields optional
    lines.push(`  ${field.name}?: ${fieldToTypeScriptType(field)};`);
  }
  lines.push('}');
  lines.push('');

  // Response DTO
  lines.push(`export interface ${entityName}Response {`);
  lines.push('  id: string;');
  for (const field of fields) {
    const optional = !field.required ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${fieldToTypeScriptType(field)};`);
  }
  for (const rel of relationships) {
    const type = rel.type === 'hasMany' ? `${rel.target}[]` : rel.target;
    lines.push(`  ${rel.name}?: ${type};`);
  }
  lines.push('  createdAt: Date;');
  lines.push('  updatedAt: Date;');
  lines.push('  createdBy?: string;');
  lines.push('  updatedBy?: string;');
  lines.push('}');
  lines.push('');

  // List Response DTO
  lines.push(`export interface ${entityName}ListResponse {`);
  lines.push(`  data: ${entityName}Response[];`);
  lines.push('  total: number;');
  lines.push('  limit: number;');
  lines.push('  offset: number;');
  lines.push('}');
  lines.push('');

  // Validation errors DTO
  lines.push(`export interface ValidationError {`);
  lines.push('  field: string;');
  lines.push('  message: string;');
  lines.push('  value?: any;');
  lines.push('}');
  lines.push('');

  // API Error Response DTO
  lines.push('export interface APIErrorResponse {');
  lines.push('  code: string;');
  lines.push('  message: string;');
  lines.push('  errors?: ValidationError[];');
  lines.push('  timestamp?: Date;');
  lines.push('  path?: string;');
  lines.push('}');
  lines.push('');

  // Class implementations
  lines.push(`/**`);
  lines.push(` * Create${entityName}RequestValidator`);
  lines.push(` * Validates create requests against schema`);
  lines.push(` */`);
  lines.push(`export class Create${entityName}RequestValidator {`);
  lines.push(`  validate(request: Create${entityName}Request): ValidationError[] {`);
  lines.push('    const errors: ValidationError[] = [];');
  lines.push('');

  // Generate validation checks
  for (const field of fields) {
    if (field.generated || field.readOnly) continue;
    if (field.required) {
      lines.push(`    if (!request.${field.name}) {`);
      lines.push(`      errors.push({ field: '${field.name}', message: '${field.name} is required' });`);
      lines.push('    }');
    }
    if (field.type === 'email') {
      lines.push(`    if (request.${field.name} && !this.isValidEmail(request.${field.name})) {`);
      lines.push(`      errors.push({ field: '${field.name}', message: '${field.name} must be a valid email' });`);
      lines.push('    }');
    }
    if (field.maxLength) {
      lines.push(`    if (request.${field.name} && request.${field.name}.length > ${field.maxLength}) {`);
      lines.push(`      errors.push({ field: '${field.name}', message: '${field.name} must not exceed ${field.maxLength} characters' });`);
      lines.push('    }');
    }
  }

  lines.push('');
  lines.push('    return errors;');
  lines.push('  }');
  lines.push('');
  lines.push('  private isValidEmail(email: string): boolean {');
  lines.push("    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;");
  lines.push('    return emailRegex.test(email);');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Factory methods
  lines.push(`/**`);
  lines.push(` * DTO Factory Methods`);
  lines.push(` */`);
  lines.push(`export class ${entityName}DTOFactory {`);
  lines.push(`  static toResponse(entity: any): ${entityName}Response {`);
  lines.push('    return {');
  lines.push('      id: entity.id,');
  for (const field of fields) {
    lines.push(`      ${field.name}: entity.${field.name},`);
  }
  lines.push('      createdAt: entity.createdAt,');
  lines.push('      updatedAt: entity.updatedAt,');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  lines.push(`  static toListResponse(entities: any[], total: number, limit: number, offset: number): ${entityName}ListResponse {`);
  lines.push('    return {');
  lines.push('      data: entities.map(e => this.toResponse(e)),');
  lines.push('      total,');
  lines.push('      limit,');
  lines.push('      offset,');
  lines.push('    };');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Convert field type to TypeScript type
 * @param {Object} field - Field definition
 * @returns {string} TypeScript type
 */
function fieldToTypeScriptType(field) {
  switch (field.type) {
    case 'string':
    case 'email':
      return 'string';
    case 'number':
      return 'number';
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'timestamp':
      return 'Date';
    case 'enum':
      return `'${(field.values || []).join("' | '")}'`;
    case 'identifier':
      return 'string';
    default:
      return 'any';
  }
}
