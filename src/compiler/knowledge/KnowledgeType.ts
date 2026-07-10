/**
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - EKM-1.0 Enterprise Knowledge Model
 * - GRA-1.0 Layer 4 Compiler
 * - GBS-1.0 Genesis Business Semantics
 */

/**
 * Knowledge Type Enumeration
 *
 * Maps Evidence IR form types to canonical Enterprise Knowledge Object types.
 * Each type represents a distinct category of knowledge that can be extracted
 * from evidence.
 */
export enum KnowledgeType {
  /**
   * Capability: Something the organization can do
   * Sources: "can X", "is able to", "has ability to"
   */
  CAPABILITY = 'capability',

  /**
   * Constraint: A limitation or restriction
   * Sources: "cannot X", "is unable to", "limited by"
   */
  CONSTRAINT = 'constraint',

  /**
   * Decision: A choice that has been made
   * Sources: "decided to", "chose", "will use"
   */
  DECISION = 'decision',

  /**
   * Need: Something required or necessary
   * Sources: "need to", "must have", "requires"
   */
  NEED = 'need',

  /**
   * Pain Point: A problem or difficulty
   * Sources: "problem with", "struggle with", "difficulty"
   */
  PAIN_POINT = 'pain_point',

  /**
   * Measurement: Quantifiable information
   * Sources: "X items", "Y percent", "Z users"
   */
  MEASUREMENT = 'measurement',

  /**
   * Interaction: How something happens or works
   * Sources: "process of", "when we", "workflow"
   */
  INTERACTION = 'interaction',

  /**
   * Obstacle: Something blocking progress
   * Sources: "blocked by", "prevented by", "obstacle"
   */
  OBSTACLE = 'obstacle',

  /**
   * Opportunity: A potential advantage or benefit
   * Sources: "could", "opportunity to", "potential"
   */
  OPPORTUNITY = 'opportunity',

  /**
   * Context: Background or situational information
   * Sources: "currently", "in the context of", "background"
   */
  CONTEXT = 'context',

  /**
   * Assumption: Something taken for granted
   * Sources: "assume", "assuming", "presumed"
   */
  ASSUMPTION = 'assumption',

  /**
   * Strategy: A planned approach or method
   * Sources: "strategy", "approach", "plan"
   */
  STRATEGY = 'strategy',
}

/**
 * Knowledge Type Configuration
 *
 * Provides metadata for each knowledge type including:
 * - Display name
 * - Description
 * - Evidence form types that map to this knowledge type
 */
export interface KnowledgeTypeConfig {
  type: KnowledgeType;
  displayName: string;
  description: string;
  evidenceFormTypes: string[];
}

/**
 * Knowledge Type Registry
 */
export const KNOWLEDGE_TYPE_CONFIGS: Record<KnowledgeType, KnowledgeTypeConfig> = {
  [KnowledgeType.CAPABILITY]: {
    type: KnowledgeType.CAPABILITY,
    displayName: 'Capability',
    description: 'Something the organization can do',
    evidenceFormTypes: ['statement', 'assertion'],
  },

  [KnowledgeType.CONSTRAINT]: {
    type: KnowledgeType.CONSTRAINT,
    displayName: 'Constraint',
    description: 'A limitation or restriction',
    evidenceFormTypes: ['constraint', 'assertion'],
  },

  [KnowledgeType.DECISION]: {
    type: KnowledgeType.DECISION,
    displayName: 'Decision',
    description: 'A choice that has been made',
    evidenceFormTypes: ['decision', 'assertion'],
  },

  [KnowledgeType.NEED]: {
    type: KnowledgeType.NEED,
    displayName: 'Need',
    description: 'Something required or necessary',
    evidenceFormTypes: ['need', 'assertion'],
  },

  [KnowledgeType.PAIN_POINT]: {
    type: KnowledgeType.PAIN_POINT,
    displayName: 'Pain Point',
    description: 'A problem or difficulty',
    evidenceFormTypes: ['pain_point', 'obstacle'],
  },

  [KnowledgeType.MEASUREMENT]: {
    type: KnowledgeType.MEASUREMENT,
    displayName: 'Measurement',
    description: 'Quantifiable information',
    evidenceFormTypes: ['measurement', 'assertion'],
  },

  [KnowledgeType.INTERACTION]: {
    type: KnowledgeType.INTERACTION,
    displayName: 'Interaction',
    description: 'How something happens or works',
    evidenceFormTypes: ['description', 'assertion'],
  },

  [KnowledgeType.OBSTACLE]: {
    type: KnowledgeType.OBSTACLE,
    displayName: 'Obstacle',
    description: 'Something blocking progress',
    evidenceFormTypes: ['obstacle', 'constraint'],
  },

  [KnowledgeType.OPPORTUNITY]: {
    type: KnowledgeType.OPPORTUNITY,
    displayName: 'Opportunity',
    description: 'A potential advantage or benefit',
    evidenceFormTypes: ['opportunity', 'assertion'],
  },

  [KnowledgeType.CONTEXT]: {
    type: KnowledgeType.CONTEXT,
    displayName: 'Context',
    description: 'Background or situational information',
    evidenceFormTypes: ['description', 'assertion'],
  },

  [KnowledgeType.ASSUMPTION]: {
    type: KnowledgeType.ASSUMPTION,
    displayName: 'Assumption',
    description: 'Something taken for granted',
    evidenceFormTypes: ['assertion', 'statement'],
  },

  [KnowledgeType.STRATEGY]: {
    type: KnowledgeType.STRATEGY,
    displayName: 'Strategy',
    description: 'A planned approach or method',
    evidenceFormTypes: ['decision', 'assertion'],
  },
};

/**
 * Validate Knowledge Type
 */
export function isValidKnowledgeType(value: string): value is KnowledgeType {
  return Object.values(KnowledgeType).includes(value as KnowledgeType);
}

/**
 * Get Knowledge Type Config
 */
export function getKnowledgeTypeConfig(type: KnowledgeType): KnowledgeTypeConfig {
  const config = KNOWLEDGE_TYPE_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown knowledge type: ${type}`);
  }
  return config;
}
