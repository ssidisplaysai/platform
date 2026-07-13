/**
 * TestRenderer
 *
 * Generates self-contained, compilable validator contract tests for every
 * generated entity.  All generated symbols are declared within the file or
 * imported from co-generated files that have no external dependencies.
 *
 * Consumes: EnterpriseObjectBlueprint
 * Produces: TypeScript Jest test file (.test.ts)
 *
 * CONTRACT GUARANTEES
 * - Never references undeclared variables
 * - Derives every emitted symbol from the blueprint (generation-time input)
 * - Imports only from ./[EntityName]Validator, which has no external imports
 * - Generates valid TypeScript under strict mode; no implicit any
 * - Deterministic: identical blueprint → identical byte-for-byte output
 *
 * @module tools/genesis/compiler/renderers/TestRenderer
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Capitalize the first character of a string.
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Escape a value for embedding inside a single-quoted TypeScript string.
 * @param {string} s
 * @returns {string}
 */
function escapeString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Format a fixture object as a multi-line TypeScript object literal.
 * Indentation is controlled by indentSpaces (the column of the opening brace).
 *
 * @param {Record<string, unknown>} obj
 * @param {number} indentSpaces - Number of spaces before the opening `{`
 * @returns {string}
 */
function formatFixture(obj, indentSpaces) {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return '{}';
  }
  const indent = ' '.repeat(indentSpaces);
  const propIndent = ' '.repeat(indentSpaces + 2);
  const result = ['{'];
  for (const [key, value] of entries) {
    result.push(`${propIndent}${key}: ${JSON.stringify(value)},`);
  }
  result.push(`${indent}}`);
  return result.join('\n');
}

/**
 * Return a suitable test-fixture value for a field, or the sentinel 'skip'
 * when the field should be excluded from fixtures (generated/timestamp fields).
 *
 * @param {Object} field - Expanded field definition from blueprint.fields.all
 * @param {string|undefined} enumFirstValue - Pre-looked-up first valid enum value for this field
 * @returns {string|number|boolean|'skip'}
 */
function defaultValueForField(field, enumFirstValue) {
  // Explicit enum override takes priority
  if (enumFirstValue !== undefined) {
    return enumFirstValue;
  }
  switch (field.type) {
    case 'email':
      return 'test@example.com';
    case 'string':
    case 'text': {
      const raw = `Test ${capitalize(field.name)}`;
      return (typeof field.maxLength === 'number' && field.maxLength > 0)
        ? raw.substring(0, Math.min(raw.length, field.maxLength))
        : raw;
    }
    case 'enum':
      return (Array.isArray(field.values) && field.values.length > 0)
        ? field.values[0]
        : 'VALUE';
    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency':
      return (typeof field.min === 'number') ? field.min : 1;
    case 'boolean':
      return true;
    case 'identifier':
    case 'timestamp':
    case 'date':
      return 'skip';
    default:
      return `test-${field.name}`;
  }
}

/**
 * Build a minimal valid fixture object from the blueprint's validation
 * constraints.  Only fields that appear in required constraints are included,
 * ensuring the fixture is deterministic and exactly covers what the validator
 * enforces.
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {Record<string, unknown>}
 */
function buildValidFixture(blueprint) {
  const constraints = blueprint.validation?.constraints ?? {};
  const required = Array.isArray(constraints.required) ? constraints.required : [];
  const enumConstraints = Array.isArray(constraints.enum) ? constraints.enum : [];
  const emailConstraints = Array.isArray(constraints.email) ? constraints.email : [];

  // Build quick-lookup tables derived entirely from the blueprint
  const fieldMap = {};
  for (const f of (blueprint.fields?.all ?? [])) {
    fieldMap[f.name] = f;
  }

  const enumFirstValue = {};
  for (const ec of enumConstraints) {
    if (Array.isArray(ec.values) && ec.values.length > 0) {
      enumFirstValue[ec.field] = ec.values[0];
    }
  }

  const emailFieldNames = new Set(emailConstraints.map(ec => ec.field));

  const fixture = {};

  for (const rc of required) {
    const field = fieldMap[rc.field];
    if (!field) {
      fixture[rc.field] = 'test-value';
      continue;
    }
    if (emailFieldNames.has(rc.field)) {
      fixture[rc.field] = 'test@example.com';
    } else if (enumFirstValue[rc.field] !== undefined) {
      fixture[rc.field] = enumFirstValue[rc.field];
    } else {
      const val = defaultValueForField(field, undefined);
      if (val !== 'skip') {
        fixture[rc.field] = val;
      }
    }
  }

  return fixture;
}

// ---------------------------------------------------------------------------
// Per-concern test generators
// ---------------------------------------------------------------------------

/**
 * Lines for a happy-path test: valid data passes validation with no errors.
 * @param {Record<string, unknown>} validFixture
 * @param {string} entityName
 * @returns {string[]}
 */
function happyPathLines(validFixture, entityName) {
  return [
    `    it('should validate valid ${entityName} data', async () => {`,
    `      const data = ${formatFixture(validFixture, 6)};`,
    `      const result: ValidationResult = await validator.validate(data);`,
    `      expect(result.isValid).toBe(true);`,
    `      expect(result.errors).toHaveLength(0);`,
    `    });`,
  ];
}

/**
 * Lines for one required-field rejection test.
 * @param {{ field: string }} constraint
 * @param {Record<string, unknown>} validFixture
 * @returns {string[]}
 */
function requiredFieldLines(constraint, validFixture) {
  const missing = Object.fromEntries(
    Object.entries(validFixture).filter(([k]) => k !== constraint.field),
  );
  return [
    `    it('should reject missing required field: ${constraint.field}', async () => {`,
    `      const data = ${formatFixture(missing, 6)};`,
    `      const result: ValidationResult = await validator.validate(data);`,
    `      expect(result.isValid).toBe(false);`,
    `      expect(result.errors.some(e => e.includes('${escapeString(constraint.field)}'))).toBe(true);`,
    `    });`,
  ];
}

/**
 * Lines for one enum-rejection test.
 * @param {{ field: string }} constraint
 * @param {Record<string, unknown>} validFixture
 * @returns {string[]}
 */
function enumRejectionLines(constraint, validFixture) {
  const invalid = { ...validFixture, [constraint.field]: 'INVALID_ENUM_VALUE' };
  return [
    `    it('should reject invalid enum value for ${constraint.field}', async () => {`,
    `      const data = ${formatFixture(invalid, 6)};`,
    `      const result: ValidationResult = await validator.validate(data);`,
    `      expect(result.isValid).toBe(false);`,
    `      expect(result.errors.some(e => e.includes('${escapeString(constraint.field)}'))).toBe(true);`,
    `    });`,
  ];
}

/**
 * Lines for one email-format rejection test.
 * @param {{ field: string }} constraint
 * @param {Record<string, unknown>} validFixture
 * @returns {string[]}
 */
function emailFormatLines(constraint, validFixture) {
  const invalid = { ...validFixture, [constraint.field]: 'not-an-email' };
  return [
    `    it('should reject invalid email format for ${constraint.field}', async () => {`,
    `      const data = ${formatFixture(invalid, 6)};`,
    `      const result: ValidationResult = await validator.validate(data);`,
    `      expect(result.isValid).toBe(false);`,
    `      expect(result.errors.some(e => e.includes('${escapeString(constraint.field)}'))).toBe(true);`,
    `    });`,
  ];
}

// ---------------------------------------------------------------------------
// Public renderer export
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained TypeScript test file from an EnterpriseObjectBlueprint.
 *
 * All test data is derived from the blueprint at generation time and embedded as
 * literals in the output.  The generated file has no runtime dependency on the
 * blueprint object or any undeclared variable.
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript test code
 */
export function generateTests(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for test generation');
  }

  const entityName = blueprint.metadata.entity;
  const validatorClassName = `${entityName}Validator`;
  const validatorImportPath = `./${entityName}Validator`;

  const constraints = blueprint.validation?.constraints ?? {};
  const requiredConstraints = Array.isArray(constraints.required) ? constraints.required : [];
  const enumConstraints = Array.isArray(constraints.enum) ? constraints.enum : [];
  const emailConstraints = Array.isArray(constraints.email) ? constraints.email : [];

  const hasConstraintTests =
    requiredConstraints.length > 0 ||
    enumConstraints.length > 0 ||
    emailConstraints.length > 0;

  const validFixture = buildValidFixture(blueprint);

  const out = [];

  // ── File header ────────────────────────────────────────────────────────────
  out.push(
    `/**`,
    ` * ${entityName} Validator Contract Tests`,
    ` *`,
    ` * Tests generated from entity validation constraints.`,
    ` * Verifies that ${validatorClassName} enforces all constraints`,
    ` * declared in the entity definition.`,
    ` *`,
    ` * @generated true`,
    ` */`,
    ``,
  );

  // ── Imports ────────────────────────────────────────────────────────────────
  // Import only from the co-generated Validator file, which has no external
  // dependencies and compiles cleanly under strict mode.
  out.push(
    `import { describe, it, expect, beforeEach } from '@jest/globals';`,
    `import { ${validatorClassName} } from '${validatorImportPath}';`,
    `import type { ValidationResult } from '${validatorImportPath}';`,
    ``,
  );

  // ── Outer describe ─────────────────────────────────────────────────────────
  out.push(`describe('${entityName} Validator Contract Tests', () => {`);

  // ── Instantiation tests (always present, no beforeEach needed) ─────────────
  out.push(
    `  describe('Instantiation', () => {`,
    `    it('should create a ${validatorClassName} instance', () => {`,
    `      const validator = new ${validatorClassName}();`,
    `      expect(validator).toBeDefined();`,
    `      expect(typeof validator.validate).toBe('function');`,
    `    });`,
    `  });`,
    ``,
  );

  // ── Constraint tests (only emitted when constraints exist in the model) ─────
  if (hasConstraintTests) {
    out.push(
      `  describe('Validation Constraints', () => {`,
      `    let validator: ${validatorClassName};`,
      ``,
      `    beforeEach(() => {`,
      `      validator = new ${validatorClassName}();`,
      `    });`,
      ``,
    );

    // Happy path (only when there are required constraints to satisfy)
    if (Object.keys(validFixture).length > 0) {
      for (const line of happyPathLines(validFixture, entityName)) {
        out.push(line);
      }
      out.push('');
    }

    // Required-field rejection — one test per constraint, in declaration order
    for (const rc of requiredConstraints) {
      for (const line of requiredFieldLines(rc, validFixture)) {
        out.push(line);
      }
      out.push('');
    }

    // Enum-value rejection — one test per constraint, in declaration order
    for (const ec of enumConstraints) {
      for (const line of enumRejectionLines(ec, validFixture)) {
        out.push(line);
      }
      out.push('');
    }

    // Email-format rejection — one test per constraint, in declaration order
    for (const ec of emailConstraints) {
      for (const line of emailFormatLines(ec, validFixture)) {
        out.push(line);
      }
      out.push('');
    }

    out.push(`  });`);
    out.push('');
  }

  // ── Close outer describe ───────────────────────────────────────────────────
  out.push(`});`);
  out.push('');

  return out.join('\n');
}
