/**
 * ValidatorRenderer
 *
 * Generates validator code from EnterpriseObjectBlueprint.
 * Creates validation rules from constraints defined in the blueprint.
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Validator class
 *
 * @module tools/genesis/compiler/renderers/ValidatorRenderer
 */

/**
 * Generate validator class code from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript validator code
 */
export function generateValidator(blueprint) {
  const entityName = blueprint.metadata.entity;
  const validation = blueprint.validation || {};
  const rules = blueprint.rules || {};

  const lines = [];
  
  // Header
  lines.push('/**');
  lines.push(` * ${entityName}Validator`);
  lines.push(' *');
  lines.push(` * Validation rules for ${entityName} entities.`);
  lines.push(' * Auto-generated from entity metadata.');
  lines.push(' *');
  lines.push(' * @generated true');
  lines.push(' */');
  lines.push('');
  
  // Interface
  lines.push('export interface ValidationResult {');
  lines.push('  isValid: boolean;');
  lines.push('  errors: string[];');
  lines.push('}');
  lines.push('');
  
  // Class declaration
  lines.push(`export class ${entityName}Validator {`);
  lines.push('  /**');
  lines.push(`   * Validate ${entityName} data`);
  lines.push('   * @param data - Data to validate');
  lines.push('   * @returns Validation result with errors');
  lines.push('   */');
  lines.push('  async validate(data: any): Promise<ValidationResult> {');
  lines.push('    const errors: string[] = [];');
  lines.push('');
  
  // Required field validation
  const requiredConstraints = validation.constraints?.required || [];
  for (const constraint of requiredConstraints) {
    lines.push(`    // Validate ${constraint.field} (required)`);
    lines.push(`    if (!data.${constraint.field}) {`);
    lines.push(`      errors.push('${escapeString(constraint.message)}');`);
    lines.push('    }');
  }
  
  // Length constraints
  const lengthConstraints = validation.constraints?.length || [];
  for (const constraint of lengthConstraints) {
    lines.push(`    // Validate ${constraint.field} length`);
    if (constraint.constraint === 'maxLength') {
      lines.push(`    if (data.${constraint.field} && String(data.${constraint.field}).length > ${constraint.value}) {`);
      lines.push(`      errors.push('${escapeString(constraint.message)}');`);
      lines.push('    }');
    } else if (constraint.constraint === 'minLength') {
      lines.push(`    if (data.${constraint.field} && String(data.${constraint.field}).length < ${constraint.value}) {`);
      lines.push(`      errors.push('${escapeString(constraint.message)}');`);
      lines.push('    }');
    }
  }
  
  // Email validation
  const emailConstraints = validation.constraints?.email || [];
  for (const constraint of emailConstraints) {
    lines.push(`    // Validate ${constraint.field} email format`);
    lines.push(`    if (data.${constraint.field} && !this.isValidEmail(String(data.${constraint.field}))) {`);
    lines.push(`      errors.push('${escapeString(constraint.message)}');`);
    lines.push('    }');
  }
  
  // Enum validation
  const enumConstraints = validation.constraints?.enum || [];
  for (const enumConstraint of enumConstraints) {
    const values = JSON.stringify(enumConstraint.values || []);
    const varName = `valid${capitalize(enumConstraint.field)}Values`;
    lines.push(`    // Validate ${enumConstraint.field} enum`);
    lines.push(`    const ${varName} = ${values};`);
    lines.push(`    if (data.${enumConstraint.field} && !${varName}.includes(data.${enumConstraint.field})) {`);
    lines.push(`      errors.push('${escapeString(enumConstraint.message)}');`);
    lines.push('    }');
  }
  
  // Range constraints
  const rangeConstraints = validation.constraints?.range || [];
  for (const constraint of rangeConstraints) {
    lines.push(`    // Validate ${constraint.field} range`);
    if (constraint.constraint === 'min') {
      lines.push(`    if (data.${constraint.field} !== undefined && data.${constraint.field} < ${constraint.value}) {`);
      lines.push(`      errors.push('${escapeString(constraint.message)}');`);
      lines.push('    }');
    } else if (constraint.constraint === 'max') {
      lines.push(`    if (data.${constraint.field} !== undefined && data.${constraint.field} > ${constraint.value}) {`);
      lines.push(`      errors.push('${escapeString(constraint.message)}');`);
      lines.push('    }');
    }
  }
  
  // Unique constraint validation
  const uniqueConstraints = validation.constraints?.unique || [];
  for (const constraint of uniqueConstraints) {
    lines.push(`    // Validate ${constraint.field} uniqueness`);
    lines.push(`    if (data.${constraint.field} && await this.isNotUnique('${constraint.field}', data.${constraint.field})) {`);
    lines.push(`      errors.push('${escapeString(constraint.message)}');`);
    lines.push('    }');
  }
  
  // Relationship constraints
  const relConstraints = validation.constraints?.relationships || [];
  for (const constraint of relConstraints) {
    lines.push(`    // Validate ${constraint.field} required relationship`);
    lines.push(`    if (!data.${constraint.field}) {`);
    lines.push(`      errors.push('${escapeString(constraint.message)}');`);
    lines.push('    }');
  }
  
  // Cross-field rules
  const crossFieldRules = rules.rules?.crossField || [];
  for (const rule of crossFieldRules) {
    const operator = rule.operator || '';
    let condition = '';
    
    switch (operator) {
      case 'greaterThan':
        condition = `data.${rule.field} <= data.${rule.compareWith}`;
        break;
      case 'greaterThanOrEqual':
        condition = `data.${rule.field} < data.${rule.compareWith}`;
        break;
      case 'lessThan':
        condition = `data.${rule.field} >= data.${rule.compareWith}`;
        break;
      case 'lessThanOrEqual':
        condition = `data.${rule.field} > data.${rule.compareWith}`;
        break;
      case 'equals':
        condition = `data.${rule.field} !== data.${rule.compareWith}`;
        break;
      case 'notEquals':
        condition = `data.${rule.field} === data.${rule.compareWith}`;
        break;
      default:
        condition = 'false';
    }
    
    if (condition) {
      lines.push(`    // Validate cross-field rule: ${rule.field} ${rule.operator} ${rule.compareWith}`);
      lines.push(`    if (data.${rule.field} && data.${rule.compareWith} && (${condition})) {`);
      lines.push(`      errors.push('${escapeString(rule.description || '')}');`);
      lines.push('    }');
    }
  }
  
  // Return result
  lines.push('');
  lines.push('    return {');
  lines.push('      isValid: errors.length === 0,');
  lines.push('      errors,');
  lines.push('    };');
  lines.push('  }');
  lines.push('');
  
  // Email validation helper
  lines.push('  /**');
  lines.push('   * Check if email is valid');
  lines.push('   * @param email - Email to validate');
  lines.push('   * @returns true if valid email format');
  lines.push('   */');
  lines.push('  private isValidEmail(email: string): boolean {');
  lines.push('    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;');
  lines.push('    return emailRegex.test(email);');
  lines.push('  }');
  lines.push('');
  
  // Uniqueness check helper
  lines.push('  /**');
  lines.push('   * Check if value is not unique (placeholder)');
  lines.push('   * Override this method to implement actual uniqueness checks');
  lines.push('   * @param field - Field name');
  lines.push('   * @param value - Value to check');
  lines.push('   * @returns true if value already exists');
  lines.push('   */');
  lines.push('  private async isNotUnique(field: string, value: any): Promise<boolean> {');
  lines.push('    // TODO: Implement database uniqueness check');
  lines.push('    return false;');
  lines.push('  }');
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Helper function to capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape single quotes in strings for template literals
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeString(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
