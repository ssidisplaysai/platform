/**
 * RulesExpander
 *
 * Expands business rule metadata into a comprehensive rules model.
 * Identifies cross-field validations, lifecycle constraints, conditional rules,
 * and complex business logic constraints.
 *
 * Metadata-driven approach: All rules derived from YAML, no entity-specific logic.
 *
 * @module tools/genesis/compiler/metadata-engine/RulesExpander
 */

/**
 * Business rule types
 */
export const RULE_TYPES = {
  CROSS_FIELD: 'crossField',           // Comparison between two fields
  LIFECYCLE_STATE: 'lifecycleState',   // Rules tied to lifecycle states
  CONDITIONAL: 'conditional',           // If/then rules
  RELATIONSHIP: 'relationship',         // Relationship-based rules
  INVARIANT: 'invariant',               // Always-true constraints
  TRIGGER: 'trigger',                  // Event-triggered rules
  CUSTOM: 'custom',                    // Custom rule from YAML
};

/**
 * Comparison operators for cross-field validation
 */
export const COMPARISON_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  GREATER_THAN: 'greaterThan',
  GREATER_THAN_OR_EQUAL: 'greaterThanOrEqual',
  LESS_THAN: 'lessThan',
  LESS_THAN_OR_EQUAL: 'lessThanOrEqual',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
};

/**
 * Expand business rules from entity definition
 * @param {Object} rulesMetadata - Rules from entity YAML (validation.rules, lifecycle constraints, etc.)
 * @param {Object} lifecycle - Lifecycle configuration
 * @param {Array<Object>} fields - Expanded field definitions
 * @param {Array<Object>} relationships - Expanded relationship definitions
 * @returns {Object} Expanded rules configuration
 */
export function expandRules(rulesMetadata, lifecycle, fields, relationships) {
  const rules = {
    enabled: false,
    rules: {
      crossField: [],      // Cross-field comparison rules
      lifecycle: [],       // Lifecycle state constraint rules
      conditional: [],     // If/then conditional rules
      relationship: [],    // Relationship constraint rules
      invariant: [],       // Invariant constraint rules
      trigger: [],         // Event-triggered rules
      custom: [],          // Custom rules from YAML
    },
    byType: {},            // Index of rules by type
    byField: {},           // Index of rules by field involved
    byState: {},           // Index of rules by lifecycle state
  };

  // Extract cross-field rules from validation.rules section
  if (rulesMetadata && Array.isArray(rulesMetadata)) {
    rulesMetadata.forEach((rule, index) => {
      // Handle cross-field comparisons (e.g., endDate > startDate)
      if (rule.comparison || rule.compareWith) {
        const crossFieldRule = {
          id: `rule_cross_${index}`,
          type: RULE_TYPES.CROSS_FIELD,
          field: rule.field,
          compareWith: rule.compareWith,
          operator: normalizeOperator(rule.comparison),
          description: rule.description,
        };
        rules.rules.crossField.push(crossFieldRule);
        addRuleToIndex(rules, crossFieldRule);
      }
      // Handle pattern/format rules
      else if (rule.pattern) {
        const customRule = {
          id: `rule_custom_${index}`,
          type: RULE_TYPES.CUSTOM,
          field: rule.field,
          pattern: rule.pattern,
          description: rule.description,
        };
        rules.rules.custom.push(customRule);
        addRuleToIndex(rules, customRule);
      }
      // Handle numeric range rules
      else if (rule.min !== undefined || rule.max !== undefined) {
        const rangeRule = {
          id: `rule_range_${index}`,
          type: RULE_TYPES.CUSTOM,
          field: rule.field,
          min: rule.min,
          max: rule.max,
          description: rule.description,
        };
        rules.rules.custom.push(rangeRule);
        addRuleToIndex(rules, rangeRule);
      }
      // Other custom rules
      else {
        const customRule = {
          id: `rule_custom_${index}`,
          type: RULE_TYPES.CUSTOM,
          ...rule,
        };
        rules.rules.custom.push(customRule);
        addRuleToIndex(rules, customRule);
      }
    });
  }

  // === LIFECYCLE STATE CONSTRAINT RULES ===
  if (lifecycle && lifecycle.states) {
    Object.entries(lifecycle.states).forEach(([state, stateConfig]) => {
      const stateRule = {
        id: `rule_lifecycle_${state}`,
        type: RULE_TYPES.LIFECYCLE_STATE,
        state: state,
        description: stateConfig.description || `Entity in ${state} state`,
        constraints: [],
      };

      // Add state-specific constraints
      // For example: COMPLETED state should have completionDate set
      if (state === 'COMPLETED' || state === 'ARCHIVED') {
        // These are implicit constraints that should be documented
        stateRule.constraints.push({
          field: 'status',
          value: state,
          message: `Status must be ${state}`,
        });
      }

      rules.rules.lifecycle.push(stateRule);
      addRuleToIndex(rules, stateRule);
    });
  }

  // === RELATIONSHIP CONSTRAINT RULES ===
  if (Array.isArray(relationships)) {
    relationships.forEach(rel => {
      if (rel.required === true) {
        const relRule = {
          id: `rule_rel_required_${rel.name}`,
          type: RULE_TYPES.RELATIONSHIP,
          relationship: rel.name,
          target: rel.target,
          required: true,
          description: `${rel.name} relationship is required`,
        };
        rules.rules.relationship.push(relRule);
        addRuleToIndex(rules, relRule);
      }

      // Cascade rules
      if (rel.cascade === true) {
        const cascadeRule = {
          id: `rule_rel_cascade_${rel.name}`,
          type: RULE_TYPES.RELATIONSHIP,
          relationship: rel.name,
          target: rel.target,
          cascade: true,
          description: `Cascade delete for ${rel.name} relationship`,
        };
        rules.rules.relationship.push(cascadeRule);
        addRuleToIndex(rules, cascadeRule);
      }
    });
  }

  // Set enabled flag if any rules exist
  rules.enabled = Object.values(rules.rules).some(arr => arr.length > 0);

  return rules;
}

/**
 * Normalize comparison operator from YAML format to standard format
 * @param {string} operator - Operator from YAML
 * @returns {string} Normalized operator
 */
function normalizeOperator(operator) {
  if (!operator) return COMPARISON_OPERATORS.EQUALS;

  const normalized = operator
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');

  const operatorMap = {
    gt: COMPARISON_OPERATORS.GREATER_THAN,
    greaterthan: COMPARISON_OPERATORS.GREATER_THAN,
    gte: COMPARISON_OPERATORS.GREATER_THAN_OR_EQUAL,
    greaterthanorequal: COMPARISON_OPERATORS.GREATER_THAN_OR_EQUAL,
    lt: COMPARISON_OPERATORS.LESS_THAN,
    lessthan: COMPARISON_OPERATORS.LESS_THAN,
    lte: COMPARISON_OPERATORS.LESS_THAN_OR_EQUAL,
    lessthanorequal: COMPARISON_OPERATORS.LESS_THAN_OR_EQUAL,
    eq: COMPARISON_OPERATORS.EQUALS,
    equals: COMPARISON_OPERATORS.EQUALS,
    neq: COMPARISON_OPERATORS.NOT_EQUALS,
    notequals: COMPARISON_OPERATORS.NOT_EQUALS,
    contains: COMPARISON_OPERATORS.CONTAINS,
    notcontains: COMPARISON_OPERATORS.NOT_CONTAINS,
  };

  return operatorMap[normalized] || COMPARISON_OPERATORS.EQUALS;
}

/**
 * Add a rule to the indexing structures
 * @param {Object} rulesConfig - Rules configuration object
 * @param {Object} rule - Rule to add
 */
function addRuleToIndex(rulesConfig, rule) {
  // Index by type
  if (!rulesConfig.byType[rule.type]) {
    rulesConfig.byType[rule.type] = [];
  }
  rulesConfig.byType[rule.type].push(rule);

  // Index by field
  const fieldKey = rule.field || rule.relationship || rule.state || 'global';
  if (!rulesConfig.byField[fieldKey]) {
    rulesConfig.byField[fieldKey] = [];
  }
  rulesConfig.byField[fieldKey].push(rule);

  // Index by state for lifecycle rules
  if (rule.state) {
    if (!rulesConfig.byState[rule.state]) {
      rulesConfig.byState[rule.state] = [];
    }
    rulesConfig.byState[rule.state].push(rule);
  }
}

/**
 * Get all cross-field rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of cross-field rules
 */
export function getCrossFieldRules(expandedRules) {
  return expandedRules.rules.crossField || [];
}

/**
 * Get all lifecycle constraint rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of lifecycle rules
 */
export function getLifecycleRules(expandedRules) {
  return expandedRules.rules.lifecycle || [];
}

/**
 * Get all conditional rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of conditional rules
 */
export function getConditionalRules(expandedRules) {
  return expandedRules.rules.conditional || [];
}

/**
 * Get all relationship constraint rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of relationship rules
 */
export function getRelationshipRules(expandedRules) {
  return expandedRules.rules.relationship || [];
}

/**
 * Get all invariant rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of invariant rules
 */
export function getInvariantRules(expandedRules) {
  return expandedRules.rules.invariant || [];
}

/**
 * Get all trigger rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of trigger rules
 */
export function getTriggerRules(expandedRules) {
  return expandedRules.rules.trigger || [];
}

/**
 * Get all custom rules
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of custom rules
 */
export function getCustomRules(expandedRules) {
  return expandedRules.rules.custom || [];
}

/**
 * Get rules for a specific field
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} fieldName - Field name
 * @returns {Array<Object>} Array of rules involving this field
 */
export function getRulesForField(expandedRules, fieldName) {
  return expandedRules.byField[fieldName] || [];
}

/**
 * Get rules for a specific lifecycle state
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} state - Lifecycle state
 * @returns {Array<Object>} Array of rules for this state
 */
export function getRulesForState(expandedRules, state) {
  return expandedRules.byState[state] || [];
}

/**
 * Get rules of a specific type
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} ruleType - Type of rule to retrieve
 * @returns {Array<Object>} Array of rules of this type
 */
export function getRulesByType(expandedRules, ruleType) {
  return expandedRules.byType[ruleType] || [];
}

/**
 * Check if a field has cross-field rules
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} fieldName - Field name
 * @returns {boolean} true if field has cross-field rules
 */
export function hasFieldCrossFieldRules(expandedRules, fieldName) {
  return expandedRules.rules.crossField.some(r => 
    r.field === fieldName || r.compareWith === fieldName
  );
}

/**
 * Get all cross-field rules involving a specific field
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} fieldName - Field name
 * @returns {Array<Object>} Array of cross-field rules involving this field
 */
export function getFieldCrossFieldRules(expandedRules, fieldName) {
  return expandedRules.rules.crossField.filter(r =>
    r.field === fieldName || r.compareWith === fieldName
  );
}

/**
 * Get all required relationships
 * @param {Object} expandedRules - Expanded rules config
 * @returns {Array<Object>} Array of required relationship rules
 */
export function getRequiredRelationships(expandedRules) {
  return expandedRules.rules.relationship.filter(r => r.required === true);
}

/**
 * Check if a relationship is required
 * @param {Object} expandedRules - Expanded rules config
 * @param {string} relationshipName - Relationship name
 * @returns {boolean} true if relationship is required
 */
export function isRelationshipRequired(expandedRules, relationshipName) {
  return expandedRules.rules.relationship.some(r =>
    r.relationship === relationshipName && r.required === true
  );
}
