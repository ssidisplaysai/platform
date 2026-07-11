/**
 * TestRenderer - Phase 9
 *
 * Generates comprehensive blueprint-driven test suites.
 * Tests verify all aspects: fields, relationships, lifecycle, permissions,
 * validation, search, and generated contracts.
 *
 * Consumes: EnterpriseObjectBlueprint
 * Produces: TypeScript Jest test file
 *
 * @module tools/genesis/compiler/renderers/TestRenderer
 */

/**
 * Generate test file from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript test code
 */
export function generateTests(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for test generation');
  }

  const entityName = blueprint.metadata.entity;
  const fields = blueprint.fields.all || [];

  const lines = [
    `/**`,
    ` * ${entityName} Entity Tests - Phase 9`,
    ` *`,
    ` * Comprehensive test suite generated from metadata.`,
    ` * Tests verify blueprint structure, fields, relationships, lifecycle,`,
    ` * permissions, validation, search, and all generated contracts.`,
    ` *`,
    ` * @generated true`,
    ` */`,
    ``,
    `import { describe, it, expect } from '@jest/globals';`,
    ``,
    `describe('${entityName} Blueprint Tests', () => {`,
  ];

  // Blueprint structure tests
  lines.push(
    `  describe('Blueprint Structure', () => {`,
    `    it('should have valid blueprint structure', () => {`,
    `      expect(blueprint).toBeDefined();`,
    `      expect(blueprint.metadata.entity).toBe('${entityName}');`,
    `      expect(blueprint.fields.all.length).toBeGreaterThan(0);`,
    `    });`,
    `  });`,
    ``,
  );

  // Field expansion tests
  lines.push(
    `  describe('Field Expansion', () => {`,
    `    it('should expand all fields from metadata', () => {`,
    `      expect(blueprint.fields.all.length).toBe(${fields.length});`,
    `      blueprint.fields.all.forEach(field => {`,
    `        expect(field.name).toBeDefined();`,
    `        expect(field.type).toBeDefined();`,
    `      });`,
    `    });`,
    ``,
    `    it('should categorize required fields', () => {`,
    `      const required = blueprint.fields.required;`,
    `      expect(required.length).toBeGreaterThan(0);`,
    `      required.forEach(f => expect(f.required).toBe(true));`,
    `    });`,
    ``,
    `    it('should categorize unique fields', () => {`,
    `      const unique = blueprint.fields.unique;`,
    `      unique.forEach(f => expect(f.unique).toBe(true));`,
    `    });`,
    `  });`,
    ``,
  );

  // Relationship tests
  const hasRels = blueprint.relationships && blueprint.relationships.all && blueprint.relationships.all.length > 0;
  if (hasRels) {
    lines.push(
      `  describe('Relationships', () => {`,
      `    it('should expand relationships', () => {`,
      `      expect(blueprint.relationships.all.length).toBeGreaterThan(0);`,
      `      blueprint.relationships.all.forEach(rel => {`,
      `        expect(rel.name).toBeDefined();`,
      `        expect(rel.type).toBeDefined();`,
      `      });`,
      `    });`,
      `  });`,
      ``,
    );
  }

  // Lifecycle tests
  lines.push(
    `  describe('Lifecycle', () => {`,
    `    it('should define lifecycle states', () => {`,
    `      expect(Object.keys(blueprint.lifecycle.states).length).toBeGreaterThan(0);`,
    `    });`,
    ``,
    `    it('should define state transitions', () => {`,
    `      expect(Array.isArray(blueprint.lifecycle.transitions)).toBe(true);`,
    `    });`,
    `  });`,
    ``,
  );

  // Permission tests
  lines.push(
    `  describe('Permissions', () => {`,
    `    it('should define roles', () => {`,
    `      expect(blueprint.permissions.roles.length).toBeGreaterThan(0);`,
    `    });`,
    ``,
    `    it('should define permission rules', () => {`,
    `      expect(Array.isArray(blueprint.permissions.rules)).toBe(true);`,
    `    });`,
    `  });`,
    ``,
  );

  // Validation tests
  lines.push(
    `  describe('Validation', () => {`,
    `    it('should have validation constraints', () => {`,
    `      expect(blueprint.validation).toBeDefined();`,
    `      expect(blueprint.validation.constraints).toBeDefined();`,
    `    });`,
    `  });`,
    ``,
  );

  // Search tests
  lines.push(
    `  describe('Search', () => {`,
    `    it('should have search capability', () => {`,
    `      expect(blueprint.search).toBeDefined();`,
    `    });`,
    `  });`,
    ``,
  );

  // Repository contract tests
  lines.push(
    `  describe('Repository Contract', () => {`,
    `    it('should define CRUD methods', () => {`,
    `      expect(blueprint.repository.methods.length).toBeGreaterThan(0);`,
    `      const names = blueprint.repository.methods.map(m => m.name);`,
    `      expect(names).toContain('findById');`,
    `      expect(names).toContain('create');`,
    `      expect(names).toContain('update');`,
    `      expect(names).toContain('delete');`,
    `    });`,
    `  });`,
    ``,
  );

  // Service contract tests
  lines.push(
    `  describe('Service Contract', () => {`,
    `    it('should define service methods', () => {`,
    `      expect(blueprint.service.methods.length).toBeGreaterThan(0);`,
    `      const names = blueprint.service.methods.map(m => m.name);`,
    `      expect(names).toContain('get');`,
    `      expect(names).toContain('list');`,
    `      expect(names).toContain('create');`,
    `    });`,
    `  });`,
    ``,
  );

  // API contract tests
  lines.push(
    `  describe('API Contract', () => {`,
    `    it('should define CRUD endpoints', () => {`,
    `      expect(blueprint.api.endpoints).toBeDefined();`,
    `      expect(blueprint.api.endpoints.create).toBeDefined();`,
    `      expect(blueprint.api.endpoints.readById).toBeDefined();`,
    `      expect(blueprint.api.endpoints.update).toBeDefined();`,
    `      expect(blueprint.api.endpoints.delete).toBeDefined();`,
    `    });`,
    ``,
    `    it('should generate OpenAPI specification', () => {`,
    `      expect(blueprint.api.openAPI).toBeDefined();`,
    `      expect(blueprint.api.openAPI.version).toBe('3.1.0');`,
    `    });`,
    ``,
    `    it('should generate GraphQL schema', () => {`,
    `      expect(blueprint.api.graphQL).toBeDefined();`,
    `      expect(blueprint.api.graphQL.type).toBe('${entityName}');`,
    `    });`,
    ``,
    `    it('should define DTO schemas', () => {`,
    `      expect(blueprint.api.dtos).toBeDefined();`,
    `      expect(blueprint.api.dtos.entity).toBeDefined();`,
    `    });`,
    `  });`,
    ``,
  );

  // Validator contract tests
  lines.push(
    `  describe('Validator Contract', () => {`,
    `    it('should have validation constraints', () => {`,
    `      expect(blueprint.validation).toBeDefined();`,
    `      expect(blueprint.validation.constraints).toBeDefined();`,
    `    });`,
    `  });`,
    ``,
  );

  // Test metadata section (Phase 9)
  lines.push(
    `  describe('Test Metadata (Phase 9)', () => {`,
    `    it('should organize tests by concern', () => {`,
    `      expect(blueprint.tests).toBeDefined();`,
    `      expect(blueprint.tests.blueprint).toBeDefined();`,
    `      expect(blueprint.tests.fields).toBeDefined();`,
    `      expect(blueprint.tests.lifecycle).toBeDefined();`,
    `      expect(blueprint.tests.permissions).toBeDefined();`,
    `      expect(blueprint.tests.validation).toBeDefined();`,
    `      expect(blueprint.tests.contracts).toBeDefined();`,
    `    });`,
    `  });`,
    ``,
  );

  lines.push(`});`);

  return lines.join('\n');
}
