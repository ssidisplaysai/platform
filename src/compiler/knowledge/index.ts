/**
 * Enterprise Knowledge Object Compiler - Knowledge Module
 *
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - EKM-1.0 Enterprise Knowledge Model
 */

export {
  KnowledgeType,
  KNOWLEDGE_TYPE_CONFIGS,
  KnowledgeTypeConfig,
  isValidKnowledgeType,
  getKnowledgeTypeConfig,
} from './KnowledgeType';

export {
  KnowledgeIdentity,
} from './KnowledgeIdentity';

export {
  KnowledgeClassification,
  VerificationState,
  KnowledgeScope,
  KnowledgeConfidence,
  KnowledgeLineage,
  KnowledgeVersion,
  KnowledgeMetadata,
  isValidConfidence,
} from './KnowledgeClassification';

export {
  EnterpriseKnowledgeObject,
  createEnterpriseKnowledgeObject,
} from './EnterpriseKnowledgeObject';

export {
  KnowledgeObjectBuilder,
} from './KnowledgeObjectBuilder';
