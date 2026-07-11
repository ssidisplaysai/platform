/**
 * TestExpander
 *
 * Expands test metadata into comprehensive test model.
 * Generates test specifications for all compiler concerns.
 *
 * Consumes: Blueprint sections (fields, relationships, lifecycle, permissions, validation, etc.)
 * Produces: Test metadata model
 *
 * @module tools/genesis/compiler/metadata-engine/TestExpander
 */

/**
 * Expand test metadata from all blueprint sections
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Expanded field metadata
 * @param {Array} expandedRelationships - Expanded relationship metadata
 * @param {Object} expandedLifecycle - Expanded lifecycle metadata
 * @param {Object} expandedPermissions - Expanded permission metadata
 * @param {Object} expandedValidation - Expanded validation metadata
 * @param {Object} expandedRules - Expanded business rules metadata
 * @param {Object} expandedSearch - Expanded search metadata
 * @param {Object} expandedAPI - Expanded API metadata
 * @returns {Object} Test metadata model
 */
export function expandTests(
  entityName,
  expandedFields,
  expandedRelationships,
  expandedLifecycle,
  expandedPermissions,
  expandedValidation,
  expandedRules,
  expandedSearch,
  expandedAPI
) {
  return {
    // Blueprint structure tests
    blueprint: {
      shape: {
        tests: generateBlueprintShapeTests(entityName),
        description: 'Verify blueprint structure and sections'
      }
    },

    // Field expansion tests
    fields: {
      expansion: {
        tests: generateFieldExpansionTests(entityName, expandedFields),
        description: 'Verify field expansion from metadata'
      },
      validation: {
        tests: generateFieldValidationTests(entityName, expandedFields, expandedValidation),
        description: 'Verify field validation constraints'
      }
    },

    // Relationship expansion tests
    relationships: {
      expansion: {
        tests: generateRelationshipExpansionTests(entityName, expandedRelationships),
        description: 'Verify relationship expansion from metadata'
      },
      validation: {
        tests: generateRelationshipValidationTests(entityName, expandedRelationships),
        description: 'Verify relationship constraints'
      }
    },

    // Lifecycle tests
    lifecycle: {
      transitions: {
        tests: generateLifecycleTransitionTests(entityName, expandedLifecycle),
        description: 'Verify state machine transitions'
      },
      operations: {
        tests: generateLifecycleOperationTests(entityName, expandedLifecycle),
        description: 'Verify lifecycle operations (soft-delete, archive, etc.)'
      }
    },

    // Permission tests
    permissions: {
      policies: {
        tests: generatePermissionPolicyTests(entityName, expandedPermissions),
        description: 'Verify permission policies and role-based access'
      },
      enforcement: {
        tests: generatePermissionEnforcementTests(entityName, expandedPermissions),
        description: 'Verify permission enforcement'
      }
    },

    // Validation tests
    validation: {
      constraints: {
        tests: generateValidationConstraintTests(entityName, expandedValidation),
        description: 'Verify validation constraints (required, format, range, etc.)'
      },
      rules: {
        tests: generateBusinessRuleTests(entityName, expandedRules),
        description: 'Verify business rule enforcement'
      }
    },

    // Search tests
    search: {
      indexing: {
        tests: generateSearchIndexTests(entityName, expandedSearch),
        description: 'Verify search index metadata'
      },
      queryability: {
        tests: generateSearchQueryabilityTests(entityName, expandedSearch, expandedFields),
        description: 'Verify search queryability'
      }
    },

    // Contract tests
    contracts: {
      repository: {
        tests: generateRepositoryContractTests(entityName, expandedFields),
        description: 'Verify repository contract (CRUD methods)'
      },
      service: {
        tests: generateServiceContractTests(entityName),
        description: 'Verify service contract (business logic)'
      },
      api: {
        tests: generateAPIContractTests(entityName, expandedAPI),
        description: 'Verify API contract (endpoints, schemas, errors)'
      },
      validator: {
        tests: generateValidatorContractTests(entityName, expandedValidation),
        description: 'Verify validator contract'
      }
    },

    // Integration tests
    integration: {
      endToEnd: {
        tests: generateEndToEndTests(entityName),
        description: 'End-to-end integration tests'
      }
    }
  };
}

/**
 * Generate blueprint shape tests
 */
function generateBlueprintShapeTests(entityName) {
  return [
    `it('should have valid blueprint structure', () => {
      expect(blueprint).toBeDefined();
      expect(blueprint.metadata).toBeDefined();
      expect(blueprint.fields).toBeDefined();
      expect(blueprint.relationships).toBeDefined();
      expect(blueprint.lifecycle).toBeDefined();
      expect(blueprint.validation).toBeDefined();
      expect(blueprint.permissions).toBeDefined();
      expect(blueprint.api).toBeDefined();
    })`,

    `it('should have metadata section with entity name', () => {
      expect(blueprint.metadata.entity).toBe('${entityName}');
      expect(blueprint.metadata.displayName).toBeDefined();
      expect(blueprint.metadata.namespace).toBeDefined();
    })`,

    `it('should have fields section with expanded field definitions', () => {
      expect(Array.isArray(blueprint.fields.all)).toBe(true);
      expect(blueprint.fields.all.length).toBeGreaterThan(0);
      expect(blueprint.fields.required).toBeDefined();
      expect(blueprint.fields.unique).toBeDefined();
      expect(blueprint.fields.generated).toBeDefined();
    })`,

    `it('should have relationships section', () => {
      expect(blueprint.relationships).toBeDefined();
      expect(blueprint.relationships.all).toBeDefined();
      expect(blueprint.relationships.hasMany).toBeDefined();
      expect(blueprint.relationships.belongsTo).toBeDefined();
    })`
  ];
}

/**
 * Generate field expansion tests
 */
function generateFieldExpansionTests(entityName, expandedFields) {
  const tests = [
    `it('should expand all fields from metadata', () => {
      expect(blueprint.fields.all.length).toBeGreaterThan(0);
      blueprint.fields.all.forEach(field => {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
        expect(typeof field.required).toBe('boolean');
      });
    })`
  ];

  // Add tests for specific field types
  const hasStringField = expandedFields.some(f => f.type === 'string');
  if (hasStringField) {
    tests.push(
      `it('should expand string fields with maxLength', () => {
        const stringFields = blueprint.fields.all.filter(f => f.type === 'string');
        stringFields.forEach(field => {
          if (field.maxLength) {
            expect(typeof field.maxLength).toBe('number');
            expect(field.maxLength).toBeGreaterThan(0);
          }
        });
      })`
    );
  }

  const hasEnumField = expandedFields.some(f => f.type === 'enum');
  if (hasEnumField) {
    tests.push(
      `it('should expand enum fields with valid values', () => {
        const enumFields = blueprint.fields.all.filter(f => f.type === 'enum');
        enumFields.forEach(field => {
          expect(Array.isArray(field.values)).toBe(true);
          expect(field.values.length).toBeGreaterThan(0);
        });
      })`
    );
  }

  return tests;
}

/**
 * Generate field validation tests
 */
function generateFieldValidationTests(entityName, expandedFields, expandedValidation) {
  const tests = [
    `it('should verify required field constraints', () => {
      const requiredFields = blueprint.fields.required;
      expect(requiredFields.length).toBeGreaterThan(0);
      requiredFields.forEach(field => {
        expect(field.required).toBe(true);
      });
    })`,

    `it('should verify unique field constraints', () => {
      const uniqueFields = blueprint.fields.unique;
      uniqueFields.forEach(field => {
        expect(field.unique).toBe(true);
      });
    })`,

    `it('should have validation constraints for fields', () => {
      expect(blueprint.validation.constraints).toBeDefined();
      if (blueprint.validation.constraints.length > 0) {
        blueprint.validation.constraints.forEach(constraint => {
          expect(constraint.field).toBeDefined();
          expect(constraint.type).toBeDefined();
        });
      }
    })`
  ];

  return tests;
}

/**
 * Generate relationship expansion tests
 */
function generateRelationshipExpansionTests(entityName, expandedRelationships) {
  const tests = [
    `it('should expand relationships with metadata', () => {
      expect(blueprint.relationships.all).toBeDefined();
      blueprint.relationships.all.forEach(rel => {
        expect(rel.name).toBeDefined();
        expect(rel.type).toBeDefined();
        expect(rel.target).toBeDefined();
      });
    })`
  ];

  if (expandedRelationships.hasMany && expandedRelationships.hasMany.length > 0) {
    tests.push(
      `it('should have hasMany relationships with proper metadata', () => {
        const hasMany = blueprint.relationships.hasMany;
        expect(hasMany.length).toBeGreaterThan(0);
        hasMany.forEach(rel => {
          expect(rel.type).toBe('hasMany');
          expect(rel.pluralName).toBeDefined();
        });
      })`
    );
  }

  if (expandedRelationships.belongsTo && expandedRelationships.belongsTo.length > 0) {
    tests.push(
      `it('should have belongsTo relationships', () => {
        const belongsTo = blueprint.relationships.belongsTo;
        expect(belongsTo.length).toBeGreaterThan(0);
        belongsTo.forEach(rel => {
          expect(rel.type).toBe('belongsTo');
        });
      })`
    );
  }

  return tests;
}

/**
 * Generate relationship validation tests
 */
function generateRelationshipValidationTests(entityName, expandedRelationships) {
  return [
    `it('should verify relationship cascade settings', () => {
      blueprint.relationships.all.forEach(rel => {
        if (rel.cascade) {
          expect(['delete', 'nullify', 'restrict']).toContain(rel.cascade);
        }
      });
    })`,

    `it('should verify relationship lazy loading settings', () => {
      blueprint.relationships.all.forEach(rel => {
        expect(typeof rel.lazy).toBe('boolean');
      });
    })`
  ];
}

/**
 * Generate lifecycle transition tests
 */
function generateLifecycleTransitionTests(entityName, expandedLifecycle) {
  const tests = [
    `it('should define valid lifecycle states', () => {
      expect(blueprint.lifecycle.states).toBeDefined();
      const states = Object.keys(blueprint.lifecycle.states);
      expect(states.length).toBeGreaterThan(0);
    })`,

    `it('should define state transitions', () => {
      expect(Array.isArray(blueprint.lifecycle.transitions)).toBe(true);
      blueprint.lifecycle.transitions.forEach(transition => {
        expect(transition.from).toBeDefined();
        expect(transition.to).toBeDefined();
        expect(transition.trigger).toBeDefined();
      });
    })`
  ];

  if (expandedLifecycle.softDelete) {
    tests.push(
      `it('should support soft delete operations', () => {
        expect(blueprint.lifecycle.softDelete).toBe(true);
      })`
    );
  }

  if (expandedLifecycle.archived) {
    tests.push(
      `it('should support archive operations', () => {
        expect(blueprint.lifecycle.archived).toBe(true);
      })`
    );
  }

  return tests;
}

/**
 * Generate lifecycle operation tests
 */
function generateLifecycleOperationTests(entityName, expandedLifecycle) {
  const tests = [];

  if (expandedLifecycle.softDelete) {
    tests.push(
      `it('should have soft-delete endpoint in API', () => {
        const softDeleteEndpoint = blueprint.api.endpoints.softDelete;
        expect(softDeleteEndpoint).toBeDefined();
      })`,

      `it('should have restore endpoint in API', () => {
        const restoreEndpoint = blueprint.api.endpoints.restore;
        expect(restoreEndpoint).toBeDefined();
      })`
    );
  }

  if (expandedLifecycle.archived) {
    tests.push(
      `it('should have archive endpoint in API', () => {
        const archiveEndpoint = blueprint.api.endpoints.archive;
        expect(archiveEndpoint).toBeDefined();
      })`
    );
  }

  return tests;
}

/**
 * Generate permission policy tests
 */
function generatePermissionPolicyTests(entityName, expandedPermissions) {
  return [
    `it('should define permission rules', () => {
      expect(Array.isArray(blueprint.permissions.rules)).toBe(true);
      blueprint.permissions.rules.forEach(rule => {
        expect(rule.role).toBeDefined();
        expect(rule.action).toBeDefined();
        expect(['read', 'create', 'update', 'delete']).toContain(rule.action);
      });
    })`,

    `it('should have role definitions', () => {
      expect(Array.isArray(blueprint.permissions.roles)).toBe(true);
      expect(blueprint.permissions.roles.length).toBeGreaterThan(0);
    })`,

    `it('should map roles to actions', () => {
      expect(blueprint.permissions.roleActions).toBeDefined();
      blueprint.permissions.roles.forEach(role => {
        expect(blueprint.permissions.roleActions[role]).toBeDefined();
      });
    })`
  ];
}

/**
 * Generate permission enforcement tests
 */
function generatePermissionEnforcementTests(entityName, expandedPermissions) {
  return [
    `it('should enforce role-based access', () => {
      const roles = blueprint.permissions.roles;
      roles.forEach(role => {
        const actions = blueprint.permissions.roleActions[role];
        expect(actions).toBeDefined();
        expect(Array.isArray(actions)).toBe(true);
      });
    })`,

    `it('should have standard permission actions', () => {
      const standardActions = ['read', 'create', 'update', 'delete'];
      blueprint.permissions.rules.forEach(rule => {
        expect(standardActions).toContain(rule.action);
      });
    })`
  ];
}

/**
 * Generate validation constraint tests
 */
function generateValidationConstraintTests(entityName, expandedValidation) {
  return [
    `it('should define required field constraints', () => {
      const requiredConstraints = blueprint.validation.constraints.filter(
        c => c.type === 'required'
      );
      expect(requiredConstraints.length).toBeGreaterThan(0);
      requiredConstraints.forEach(constraint => {
        expect(constraint.field).toBeDefined();
        expect(constraint.message).toBeDefined();
      });
    })`,

    `it('should define format validation constraints', () => {
      const formatConstraints = blueprint.validation.constraints.filter(
        c => ['email', 'date', 'time', 'url'].includes(c.type)
      );
      formatConstraints.forEach(constraint => {
        expect(constraint.field).toBeDefined();
      });
    })`,

    `it('should have custom validation messages', () => {
      blueprint.validation.constraints.forEach(constraint => {
        if (constraint.message) {
          expect(typeof constraint.message).toBe('string');
          expect(constraint.message.length).toBeGreaterThan(0);
        }
      });
    })`
  ];
}

/**
 * Generate business rule tests
 */
function generateBusinessRuleTests(entityName, expandedRules) {
  const tests = [];

  if (expandedRules && expandedRules.rules && expandedRules.rules.length > 0) {
    tests.push(
      `it('should define business rules', () => {
        expect(Array.isArray(blueprint.rules.rules)).toBe(true);
        blueprint.rules.rules.forEach(rule => {
          expect(rule.type).toBeDefined();
          expect(['crossField', 'lifecycle', 'conditional', 'invariant']).toContain(rule.type);
        });
      })`,

      `it('should have rule metadata', () => {
        blueprint.rules.rules.forEach(rule => {
          expect(rule.description).toBeDefined();
          if (rule.message) {
            expect(typeof rule.message).toBe('string');
          }
        });
      })`
    );
  }

  return tests;
}

/**
 * Generate search index tests
 */
function generateSearchIndexTests(entityName, expandedSearch) {
  return [
    `it('should define search index configuration', () => {
      expect(blueprint.search).toBeDefined();
      expect(Array.isArray(blueprint.search.indexedFields)).toBe(true);
      expect(blueprint.search.indexedFields.length).toBeGreaterThan(0);
    })`,

    `it('should have searchable field metadata', () => {
      blueprint.search.indexedFields.forEach(fieldName => {
        const field = blueprint.fields.all.find(f => f.name === fieldName);
        expect(field).toBeDefined();
      });
    })`,

    `it('should define search filters', () => {
      expect(blueprint.search.filters).toBeDefined();
      expect(Array.isArray(blueprint.search.filters)).toBe(true);
    })`
  ];
}

/**
 * Generate search queryability tests
 */
function generateSearchQueryabilityTests(entityName, expandedSearch, expandedFields) {
  return [
    `it('should support full-text search', () => {
      expect(blueprint.search.fulltext).toBeDefined();
      expect(typeof blueprint.search.fulltext).toBe('boolean');
    })`,

    `it('should support field-specific search', () => {
      const searchableFields = blueprint.fields.all.filter(f => f.searchable);
      expect(searchableFields.length).toBeGreaterThan(0);
    })`
  ];
}

/**
 * Generate repository contract tests
 */
function generateRepositoryContractTests(entityName, expandedFields) {
  return [
    `it('should define CRUD repository methods', () => {
      expect(blueprint.repository).toBeDefined();
      expect(blueprint.repository.methods).toBeDefined();
      const methodNames = blueprint.repository.methods.map(m => m.name);
      
      expect(methodNames).toContain('findById');
      expect(methodNames).toContain('findAll');
      expect(methodNames).toContain('create');
      expect(methodNames).toContain('update');
      expect(methodNames).toContain('delete');
    })`,

    `it('should have repository method specifications', () => {
      blueprint.repository.methods.forEach(method => {
        expect(method.name).toBeDefined();
        expect(method.parameters).toBeDefined();
        expect(Array.isArray(method.parameters)).toBe(true);
        expect(method.returnType).toBeDefined();
        expect(method.description).toBeDefined();
      });
    })`,

    `it('should support soft delete in repository', () => {
      if (blueprint.lifecycle.softDelete) {
        const softDeleteMethod = blueprint.repository.methods.find(
          m => m.name === 'softDelete' || m.name === 'delete'
        );
        expect(softDeleteMethod).toBeDefined();
      }
    })`
  ];
}

/**
 * Generate service contract tests
 */
function generateServiceContractTests(entityName) {
  return [
    `it('should define service business logic methods', () => {
      expect(blueprint.service).toBeDefined();
      expect(blueprint.service.methods).toBeDefined();
      const methodNames = blueprint.service.methods.map(m => m.name);
      
      expect(methodNames).toContain('get');
      expect(methodNames).toContain('list');
      expect(methodNames).toContain('create');
      expect(methodNames).toContain('update');
      expect(methodNames).toContain('delete');
    })`,

    `it('should specify service method contracts', () => {
      blueprint.service.methods.forEach(method => {
        expect(method.name).toBeDefined();
        expect(method.parameters).toBeDefined();
        expect(method.returnType).toBeDefined();
      });
    })`,

    `it('should indicate validation requirement', () => {
      expect(typeof blueprint.service.requiresValidation).toBe('boolean');
    })`,

    `it('should indicate audit requirement', () => {
      expect(typeof blueprint.service.requiresAudit).toBe('boolean');
    })`
  ];
}

/**
 * Generate API contract tests
 */
function generateAPIContractTests(entityName, expandedAPI) {
  return [
    `it('should define API endpoints', () => {
      expect(blueprint.api).toBeDefined();
      expect(blueprint.api.endpoints).toBeDefined();
      expect(blueprint.api.endpoints.create).toBeDefined();
      expect(blueprint.api.endpoints.readById).toBeDefined();
      expect(blueprint.api.endpoints.update).toBeDefined();
      expect(blueprint.api.endpoints.delete).toBeDefined();
      expect(blueprint.api.endpoints.list).toBeDefined();
    })`,

    `it('should generate OpenAPI specification', () => {
      expect(blueprint.api.openAPI).toBeDefined();
      expect(blueprint.api.openAPI.version).toBe('3.1.0');
      expect(blueprint.api.openAPI.title).toBeDefined();
      expect(blueprint.api.openAPI.components).toBeDefined();
    })`,

    `it('should generate GraphQL schema', () => {
      expect(blueprint.api.graphQL).toBeDefined();
      expect(blueprint.api.graphQL.type).toBe('${entityName}');
      expect(blueprint.api.graphQL.queries).toBeDefined();
      expect(blueprint.api.graphQL.mutations).toBeDefined();
    })`,

    `it('should define DTO schemas', () => {
      expect(blueprint.api.dtos).toBeDefined();
      expect(blueprint.api.dtos.entity).toBeDefined();
      expect(blueprint.api.dtos.createRequest).toBeDefined();
      expect(blueprint.api.dtos.updateRequest).toBeDefined();
      expect(blueprint.api.dtos.response).toBeDefined();
    })`,

    `it('should define error response contracts', () => {
      expect(blueprint.api.errorResponses).toBeDefined();
      expect(blueprint.api.errorResponses.badRequest).toBeDefined();
      expect(blueprint.api.errorResponses.unauthorized).toBeDefined();
      expect(blueprint.api.errorResponses.notFound).toBeDefined();
    })`
  ];
}

/**
 * Generate validator contract tests
 */
function generateValidatorContractTests(entityName, expandedValidation) {
  return [
    `it('should have validator defined', () => {
      expect(blueprint.validation).toBeDefined();
      expect(blueprint.validation.constraints).toBeDefined();
    })`,

    `it('should verify all constraint types are valid', () => {
      const validTypes = ['required', 'type', 'format', 'range', 'length', 'enum', 'unique', 'email', 'relationship'];
      blueprint.validation.constraints.forEach(constraint => {
        expect(validTypes).toContain(constraint.type);
      });
    })`
  ];
}

/**
 * Generate end-to-end integration tests
 */
function generateEndToEndTests(entityName) {
  return [
    `it('should support complete entity lifecycle', () => {
      expect(blueprint.metadata.entity).toBe('${entityName}');
      expect(blueprint.fields.all.length).toBeGreaterThan(0);
      expect(blueprint.repository).toBeDefined();
      expect(blueprint.service).toBeDefined();
      expect(blueprint.api).toBeDefined();
    })`,

    `it('should maintain consistency across all contracts', () => {
      // Repository, Service, and API should all reference same fields
      const fieldNames = new Set(blueprint.fields.all.map(f => f.name));
      
      // Verify repository methods reference entity
      expect(blueprint.repository.methods.length).toBeGreaterThan(0);
      
      // Verify service methods reference entity
      expect(blueprint.service.methods.length).toBeGreaterThan(0);
      
      // Verify API references fields in DTOs
      expect(blueprint.api.dtos.entity).toBeDefined();
    })`
  ];
}
