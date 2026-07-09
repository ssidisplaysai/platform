/**
 * ValidationExpander
 *
 * Expands field-level validation metadata into a comprehensive validation model.
 * Identifies required fields, type constraints, length limits, ranges, patterns,
 * and uniqueness constraints.
 *
 * Metadata-driven approach: All validation behavior derived from YAML, no entity-specific logic.
 *
 * @module tools/genesis/compiler/metadata-engine/ValidationExpander
 */

/**
 * Validation constraint types
 */
export const VALIDATION_TYPES = {
  REQUIRED: 'required',
  TYPE: 'type',
  LENGTH: 'length',
  PATTERN: 'pattern',
  RANGE: 'range',
  ENUM: 'enum',
  UNIQUE: 'unique',
  EMAIL: 'email',
  RELATIONSHIP_REQUIRED: 'relationshipRequired',
  CUSTOM: 'custom',
};

/**
 * Field types that support different constraint categories
 */
export const STRING_FIELD_TYPES = ['string', 'text', 'email', 'identifier', 'code'];
export const NUMERIC_FIELD_TYPES = ['number', 'integer', 'decimal', 'currency'];
export const DATE_FIELD_TYPES = ['timestamp', 'date'];
export const BOOLEAN_FIELD_TYPES = ['boolean'];
export const ENUM_FIELD_TYPES = ['enum', 'status', 'state'];

/**
 * Expand validation metadata from entity definition and fields
 * @param {Object} validationMetadata - Validation capability from entity YAML
 * @param {Array<Object>} fields - Expanded field definitions
 * @param {Array<Object>} relationships - Expanded relationship definitions
 * @returns {Object} Expanded validation configuration
 */
export function expandValidation(validationMetadata, fields, relationships) {
  const validation = {
    enabled: false,
    constraints: {
      required: [],        // Required field constraints
      type: [],            // Type validation constraints
      format: [],          // Format/pattern constraints
      range: [],           // Numeric/date range constraints
      length: [],          // String length constraints
      enum: [],            // Enum value constraints
      unique: [],          // Uniqueness constraints
      email: [],           // Email format constraints
      relationships: [],   // Relationship constraints
    },
    custom: [],            // Custom validation rules from YAML
    messages: {},          // Custom error messages
  };

  // Exit early if validation not enabled
  if (!validationMetadata || validationMetadata.enabled !== true) {
    return validation;
  }

  validation.enabled = true;

  // Build field map for quick lookup
  const fieldMap = {};
  if (Array.isArray(fields)) {
    fields.forEach(field => {
      fieldMap[field.name] = field;
    });
  }

  // Process each field for constraints
  if (Array.isArray(fields)) {
    fields.forEach(field => {
      // Skip generated fields (id, timestamps auto-generated)
      if (field.generated) {
        return;
      }

      // === REQUIRED CONSTRAINT ===
      if (field.required === true) {
        validation.constraints.required.push({
          field: field.name,
          type: VALIDATION_TYPES.REQUIRED,
          message: `${field.name} is required`,
        });
      }

      // === TYPE CONSTRAINTS ===
      // Email type
      if (field.type === 'email') {
        validation.constraints.email.push({
          field: field.name,
          type: VALIDATION_TYPES.EMAIL,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          message: `${field.name} must be a valid email address`,
        });
      }

      // Enum type
      if (field.type === 'enum' && Array.isArray(field.values) && field.values.length > 0) {
        validation.constraints.enum.push({
          field: field.name,
          type: VALIDATION_TYPES.ENUM,
          values: field.values,
          default: field.default || null,
          message: `${field.name} must be one of: ${field.values.join(', ')}`,
        });
      }

      // === STRING CONSTRAINTS ===
      if (STRING_FIELD_TYPES.includes(field.type)) {
        // Max length
        if (field.maxLength !== undefined && field.maxLength !== null) {
          validation.constraints.length.push({
            field: field.name,
            type: VALIDATION_TYPES.LENGTH,
            constraint: 'maxLength',
            value: field.maxLength,
            message: `${field.name} must not exceed ${field.maxLength} characters`,
          });
        }

        // Min length
        if (field.minLength !== undefined && field.minLength !== null && field.minLength > 0) {
          validation.constraints.length.push({
            field: field.name,
            type: VALIDATION_TYPES.LENGTH,
            constraint: 'minLength',
            value: field.minLength,
            message: `${field.name} must be at least ${field.minLength} characters`,
          });
        }

        // Pattern (regex)
        if (field.pattern !== undefined && field.pattern !== null) {
          validation.constraints.format.push({
            field: field.name,
            type: VALIDATION_TYPES.PATTERN,
            pattern: field.pattern,
            message: `${field.name} does not match required pattern: ${field.pattern}`,
          });
        }
      }

      // === NUMERIC CONSTRAINTS ===
      if (NUMERIC_FIELD_TYPES.includes(field.type)) {
        // Min value
        if (field.min !== undefined && field.min !== null) {
          validation.constraints.range.push({
            field: field.name,
            type: VALIDATION_TYPES.RANGE,
            constraint: 'min',
            value: field.min,
            message: `${field.name} must be at least ${field.min}`,
          });
        }

        // Max value
        if (field.max !== undefined && field.max !== null) {
          validation.constraints.range.push({
            field: field.name,
            type: VALIDATION_TYPES.RANGE,
            constraint: 'max',
            value: field.max,
            message: `${field.name} must not exceed ${field.max}`,
          });
        }
      }

      // === UNIQUE CONSTRAINT ===
      if (field.unique === true && field.generated !== true) {
        validation.constraints.unique.push({
          field: field.name,
          type: VALIDATION_TYPES.UNIQUE,
          message: `${field.name} must be unique`,
        });
      }
    });
  }

  // === RELATIONSHIP CONSTRAINTS ===
  if (Array.isArray(relationships)) {
    relationships.forEach(rel => {
      if (rel.required === true) {
        validation.constraints.relationships.push({
          field: rel.name,
          type: VALIDATION_TYPES.RELATIONSHIP_REQUIRED,
          message: `${rel.name} is required`,
        });
      }
    });
  }

  // === CUSTOM VALIDATION RULES FROM YAML ===
  if (validationMetadata.rules && Array.isArray(validationMetadata.rules)) {
    validationMetadata.rules.forEach((rule, index) => {
      const customRule = {
        id: `rule_${index}`,
        field: rule.field,
        type: rule.type || VALIDATION_TYPES.CUSTOM,
        ...rule, // Include all rule properties
      };

      // Add to appropriate constraint category if known type
      if (rule.type === 'number' && (rule.min !== undefined || rule.max !== undefined)) {
        validation.constraints.range.push(customRule);
      } else if (rule.type === 'date' || rule.type === 'comparison') {
        // Cross-field comparison rules are handled by RulesExpander
        validation.custom.push(customRule);
      } else if (rule.pattern) {
        validation.constraints.format.push(customRule);
      } else {
        validation.custom.push(customRule);
      }
    });
  }

  return validation;
}

/**
 * Get all required fields
 * @param {Object} expandedValidation - Expanded validation config
 * @returns {Array<string>} Array of required field names
 */
export function getRequiredFields(expandedValidation) {
  return expandedValidation.constraints.required
    .map(c => c.field)
    .filter((f, i, arr) => arr.indexOf(f) === i); // dedupe
}

/**
 * Get all unique fields
 * @param {Object} expandedValidation - Expanded validation config
 * @returns {Array<string>} Array of unique field names
 */
export function getUniqueFields(expandedValidation) {
  return expandedValidation.constraints.unique
    .map(c => c.field)
    .filter((f, i, arr) => arr.indexOf(f) === i); // dedupe
}

/**
 * Get all enum fields with their allowed values
 * @param {Object} expandedValidation - Expanded validation config
 * @returns {Object<string, Array>} Map of field names to allowed values
 */
export function getEnumFields(expandedValidation) {
  const result = {};
  expandedValidation.constraints.enum.forEach(c => {
    result[c.field] = c.values;
  });
  return result;
}

/**
 * Get all field constraints of a specific type
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} constraintType - Type of constraint (required, length, range, etc.)
 * @returns {Array<Object>} Array of matching constraints
 */
export function getConstraintsByType(expandedValidation, constraintType) {
  const categoryMap = {
    required: 'required',
    type: 'type',
    format: 'format',
    range: 'range',
    length: 'length',
    enum: 'enum',
    unique: 'unique',
    email: 'email',
    relationship: 'relationships',
  };

  const category = categoryMap[constraintType];
  if (!category) {
    return [];
  }

  return expandedValidation.constraints[category] || [];
}

/**
 * Get length constraints for a specific field
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {Object} Object with minLength and maxLength properties
 */
export function getFieldLengthConstraints(expandedValidation, fieldName) {
  const constraints = { minLength: null, maxLength: null };
  
  expandedValidation.constraints.length
    .filter(c => c.field === fieldName)
    .forEach(c => {
      if (c.constraint === 'minLength') {
        constraints.minLength = c.value;
      } else if (c.constraint === 'maxLength') {
        constraints.maxLength = c.value;
      }
    });

  return constraints;
}

/**
 * Get range constraints for a specific field
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {Object} Object with min and max properties
 */
export function getFieldRangeConstraints(expandedValidation, fieldName) {
  const constraints = { min: null, max: null };

  expandedValidation.constraints.range
    .filter(c => c.field === fieldName)
    .forEach(c => {
      if (c.constraint === 'min') {
        constraints.min = c.value;
      } else if (c.constraint === 'max') {
        constraints.max = c.value;
      }
    });

  return constraints;
}

/**
 * Get pattern constraint for a specific field
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {string|null} Pattern string or null
 */
export function getFieldPattern(expandedValidation, fieldName) {
  const constraint = expandedValidation.constraints.format
    .find(c => c.field === fieldName && c.type === VALIDATION_TYPES.PATTERN);
  return constraint ? constraint.pattern : null;
}

/**
 * Get email constraint for a specific field
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {Object|null} Email constraint or null
 */
export function getFieldEmailConstraint(expandedValidation, fieldName) {
  return expandedValidation.constraints.email.find(c => c.field === fieldName) || null;
}

/**
 * Get enum values for a specific field
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {Array<string>|null} Allowed values or null
 */
export function getFieldEnumValues(expandedValidation, fieldName) {
  const constraint = expandedValidation.constraints.enum.find(c => c.field === fieldName);
  return constraint ? constraint.values : null;
}

/**
 * Check if a field is required
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {boolean} true if field is required
 */
export function isFieldRequired(expandedValidation, fieldName) {
  return expandedValidation.constraints.required.some(c => c.field === fieldName);
}

/**
 * Check if a field is unique
 * @param {Object} expandedValidation - Expanded validation config
 * @param {string} fieldName - Field name
 * @returns {boolean} true if field is unique
 */
export function isFieldUnique(expandedValidation, fieldName) {
  return expandedValidation.constraints.unique.some(c => c.field === fieldName);
}
