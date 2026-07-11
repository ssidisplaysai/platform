/**
 * BlueprintValidator.mjs
 *
 * Validates GEDL definitions before blueprint creation.
 *
 * Purpose:
 *   - Enforces GEDL schema
 *   - Validates field definitions
 *   - Validates relationships
 *   - Detects configuration errors early
 */

const FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "identifier",
  "email",
  "timestamp",
  "date",
  "enum",
  "text",
  "decimal",
  "json",
];

const RELATIONSHIP_TYPES = ["hasOne", "hasMany", "belongsTo", "belongsToMany"];

const VALID_CAPABILITIES = [
  "search",
  "audit",
  "validation",
  "permissions",
  "versioning",
];

/**
 * Validate a GEDL definition object
 *
 * @param {Object} definition - Raw GEDL definition from YAML
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateGEDLDefinition(definition) {
  const errors = [];

  // Check required fields
  if (!definition.entity) {
    errors.push("Missing required field: entity");
  }

  if (!definition.displayName) {
    errors.push("Missing required field: displayName");
  }

  if (!definition.description) {
    errors.push("Missing recommended field: description");
  }

  // Validate entity name format
  if (definition.entity && !/^[A-Z][a-zA-Z0-9]*$/.test(definition.entity)) {
    errors.push(
      "entity name must start with uppercase letter and contain only alphanumeric characters"
    );
  }

  // Validate fields
  if (definition.fields && typeof definition.fields === "object") {
    for (const [fieldName, fieldConfig] of Object.entries(definition.fields)) {
      const fieldErrors = validateFieldDefinition(fieldName, fieldConfig);
      errors.push(...fieldErrors);
    }
  }

  // Validate relationships
  if (definition.relationships && typeof definition.relationships === "object") {
    for (const [relName, relConfig] of Object.entries(definition.relationships)) {
      const relErrors = validateRelationshipDefinition(relName, relConfig);
      errors.push(...relErrors);
    }
  }

  // Validate capabilities
  if (definition.capabilities && typeof definition.capabilities === "object") {
    for (const [capName, capConfig] of Object.entries(definition.capabilities)) {
      if (!VALID_CAPABILITIES.includes(capName)) {
        errors.push(
          `Unknown capability: ${capName}. Valid capabilities: ${VALID_CAPABILITIES.join(", ")}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a field definition
 */
function validateFieldDefinition(fieldName, fieldConfig) {
  const errors = [];

  if (!fieldConfig.type) {
    errors.push(`Field '${fieldName}': missing type`);
  } else if (!FIELD_TYPES.includes(fieldConfig.type)) {
    errors.push(
      `Field '${fieldName}': invalid type '${fieldConfig.type}'. Valid types: ${FIELD_TYPES.join(", ")}`
    );
  }

  if (fieldConfig.type === "enum" && !fieldConfig.values) {
    errors.push(`Field '${fieldName}': enum fields require 'values' array`);
  }

  if (fieldConfig.type === "enum" && Array.isArray(fieldConfig.values)) {
    if (fieldConfig.values.length === 0) {
      errors.push(`Field '${fieldName}': enum must have at least one value`);
    }
  }

  return errors.map((err) => `  ${err}`);
}

/**
 * Validate a relationship definition
 */
function validateRelationshipDefinition(relName, relConfig) {
  const errors = [];

  if (!relConfig.type) {
    errors.push(`Relationship '${relName}': missing type`);
  } else if (!RELATIONSHIP_TYPES.includes(relConfig.type)) {
    errors.push(
      `Relationship '${relName}': invalid type '${relConfig.type}'. Valid types: ${RELATIONSHIP_TYPES.join(", ")}`
    );
  }

  if (!relConfig.target) {
    errors.push(`Relationship '${relName}': missing target entity`);
  }

  return errors.map((err) => `  ${err}`);
}

/**
 * Check if definition is valid for blueprint creation
 */
export function isValidForBlueprint(validationResult) {
  return validationResult.isValid && validationResult.errors.length === 0;
}
