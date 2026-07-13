/**
 * ValidatorRenderer
 *
 * Generates self-contained, compilable validators from
 * EnterpriseObjectBlueprint with no implicit any.
 *
 * Contract:
 * - No external imports
 * - All types explicitly defined
 * - Validation rules derived only from blueprint fields
 * - Deterministic rule ordering (sorted by field name)
 * - Enum validation via string-literal unions
 * - Required, length, range, regex validation
 * - Byte-for-byte identical output across repeated generation
 *
 * @module tools/genesis/compiler/renderers/ValidatorRenderer
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function toCamelCase(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

/**
 * Generate validation rules from field definition.
 * Returns array of validation rule objects.
 */
function extractValidationRules(field) {
  if (!field) return [];
  
  const rules = [];
  
  // Required validation
  if (field.required) {
    rules.push({
      type: 'required',
      fieldName: field.name,
      message: field.name + ' is required',
    });
  }
  
  // Enum validation
  if (field.type === 'enum' && Array.isArray(field.values) && field.values.length > 0) {
    rules.push({
      type: 'enum',
      fieldName: field.name,
      values: field.values,
      message: field.name + ' must be one of: ' + field.values.join(', '),
    });
  }
  
  // String length validation
  if (field.type === 'string' || field.type === 'text' || field.type === 'email') {
    if (typeof field.maxLength === 'number' && field.maxLength > 0) {
      rules.push({
        type: 'maxLength',
        fieldName: field.name,
        value: field.maxLength,
        message: field.name + ' must not exceed ' + field.maxLength + ' characters',
      });
    }
    if (typeof field.minLength === 'number' && field.minLength > 0) {
      rules.push({
        type: 'minLength',
        fieldName: field.name,
        value: field.minLength,
        message: field.name + ' must be at least ' + field.minLength + ' characters',
      });
    }
  }
  
  // Email format validation
  if (field.type === 'email') {
    rules.push({
      type: 'email',
      fieldName: field.name,
      message: field.name + ' must be a valid email address',
    });
  }
  
  // Regex pattern validation
  if (field.pattern && typeof field.pattern === 'string') {
    rules.push({
      type: 'regex',
      fieldName: field.name,
      pattern: field.pattern,
      message: field.message || field.name + ' format is invalid',
    });
  }
  
  // Numeric min/max validation
  if (field.type === 'number' || field.type === 'integer' || field.type === 'currency') {
    if (typeof field.minimum === 'number') {
      rules.push({
        type: 'min',
        fieldName: field.name,
        value: field.minimum,
        message: field.name + ' must be at least ' + field.minimum,
      });
    }
    if (typeof field.maximum === 'number') {
      rules.push({
        type: 'max',
        fieldName: field.name,
        value: field.maximum,
        message: field.name + ' must not exceed ' + field.maximum,
      });
    }
  }
  
  return rules;
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

/**
 * Generate validator from blueprint.
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript source code
 */
export function generateValidator(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for validator generation');
  }

  const entityName = blueprint.metadata.entity;
  const allFields = (blueprint.fields && blueprint.fields.all) ? blueprint.fields.all : [];

  // Extract all validation rules, sorted by field name for determinism
  const allRules = [];
  for (const field of allFields) {
    const rules = extractValidationRules(field);
    allRules.push(...rules);
  }
  
  // Sort rules by field name, then by rule type for determinism
  allRules.sort((a, b) => {
    const fieldCmp = (a.fieldName || '').localeCompare(b.fieldName || '');
    if (fieldCmp !== 0) return fieldCmp;
    return (a.type || '').localeCompare(b.type || '');
  });

  const L = [];

  // ── File header ────────────────────────────────────────────────────────────
  L.push('/**');
  L.push(' * ' + entityName + 'Validator');
  L.push(' *');
  L.push(' * Deterministic validation rules for ' + entityName + ' entities.');
  L.push(' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.');
  L.push(' *');
  L.push(' * @generated true');
  L.push(' */');
  L.push('');

  // ── Validation Result Interface ────────────────────────────────────────────
  L.push('/** Structured validation result. */');
  L.push('export interface ValidationError {');
  L.push('  field: string;');
  L.push('  message: string;');
  L.push('}');
  L.push('');

  L.push('/** Validation result envelope. */');
  L.push('export interface ValidationResult {');
  L.push('  isValid: boolean;');
  L.push('  errors: readonly ValidationError[];');
  L.push('}');
  L.push('');

  // ── Validator Class ───────────────────────────────────────────────────────
  L.push('/** Validator for ' + entityName + ' entities. */');
  L.push('export class ' + entityName + 'Validator {');
  L.push('  /**');
  L.push('   * Validate ' + entityName + ' data.');
  L.push('   * @param data - Object to validate');
  L.push('   * @returns Validation result with errors if invalid');
  L.push('   */');
  L.push('  validate(data: Record<string, unknown>): ValidationResult {');
  L.push('    const errors: ValidationError[] = [];');
  L.push('');

  // Generate validation checks for each rule
  for (const rule of allRules) {
    const field = rule.fieldName;

    if (rule.type === 'required') {
      L.push('    // Required: ' + field);
      L.push('    if (!data.' + field + ') {');
      L.push('      errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'enum') {
      L.push('    // Enum: ' + field);
      L.push('    if (data.' + field + ') {');
      const enumValues = rule.values.map(v => "'" + v + "'").join(', ');
      L.push('      const validValues: readonly string[] = [' + enumValues + '];');
      L.push('      if (!validValues.includes(String(data.' + field + '))) {');
      L.push('        errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('      }');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'maxLength') {
      L.push('    // Max length: ' + field);
      L.push('    if (data.' + field + ' && String(data.' + field + ').length > ' + rule.value + ') {');
      L.push('      errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'minLength') {
      L.push('    // Min length: ' + field);
      L.push('    if (data.' + field + ' && String(data.' + field + ').length < ' + rule.value + ') {');
      L.push('      errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'email') {
      L.push('    // Email format: ' + field);
      L.push('    if (data.' + field + ' && !this.isValidEmail(String(data.' + field + '))) {');
      L.push('      errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'regex') {
      L.push('    // Regex pattern: ' + field);
      L.push('    if (data.' + field + ') {');
      L.push('      const pattern = /' + rule.pattern + '/;');
      L.push('      if (!pattern.test(String(data.' + field + '))) {');
      L.push('        errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('      }');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'min') {
      L.push('    // Minimum value: ' + field);
      L.push('    if (data.' + field + ' !== undefined && data.' + field + ' !== null) {');
      L.push('      const numValue = typeof data.' + field + ' === \'number\' ? data.' + field + ' : Number(data.' + field + ');');
      L.push('      if (!isNaN(numValue) && numValue < ' + rule.value + ') {');
      L.push('        errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('      }');
      L.push('    }');
      L.push('');
    } else if (rule.type === 'max') {
      L.push('    // Maximum value: ' + field);
      L.push('    if (data.' + field + ' !== undefined && data.' + field + ' !== null) {');
      L.push('      const numValue = typeof data.' + field + ' === \'number\' ? data.' + field + ' : Number(data.' + field + ');');
      L.push('      if (!isNaN(numValue) && numValue > ' + rule.value + ') {');
      L.push('        errors.push({ field: \'' + field + '\', message: \'' + rule.message + '\' });');
      L.push('      }');
      L.push('    }');
      L.push('');
    }
  }

  // Return statement
  L.push('    return Object.freeze({');
  L.push('      isValid: errors.length === 0,');
  L.push('      errors: Object.freeze(errors),');
  L.push('    });');
  L.push('  }');
  L.push('');

  // ── Helper Methods ─────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Validate email format.');
  L.push('   * @param email - Email string to validate');
  L.push('   * @returns true if valid email');
  L.push('   */');
  L.push('  private isValidEmail(email: string): boolean {');
  L.push('    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;');
  L.push('    return emailRegex.test(email);');
  L.push('  }');
  L.push('}');
  L.push('');

  return L.join('\n');
}
