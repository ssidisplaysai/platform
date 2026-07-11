/**
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - EKM-1.0 Enterprise Knowledge Model
 */

import { KnowledgeType } from './KnowledgeType';
import {
  KnowledgeClassification,
  VerificationState,
  KnowledgeScope,
  KnowledgeConfidence,
  KnowledgeLineage,
  KnowledgeVersion,
} from './KnowledgeClassification';

/**
 * Enterprise Knowledge Object (EKO)
 *
 * Canonical representation of extracted, typed knowledge from Evidence IR.
 *
 * Properties:
 * - Immutable Knowledge ID (content-addressed per GPS-0001)
 * - Canonical Name (human-readable)
 * - Canonical Type (one of 12 knowledge types)
 * - Knowledge Classification (extracted, inferred, etc.)
 * - Semantic References (related concepts)
 * - Evidence References (source evidence)
 * - Source References (original source information)
 * - Initial Confidence ([0, 1] range)
 * - Verification State (initially Unverified)
 * - Lineage Information (trace to source)
 * - Provenance Information (complete history)
 * - Owner Metadata (responsible party)
 * - Scope Metadata (applicability)
 * - Version Metadata (version tracking)
 * - Creation Timestamp (immutable)
 * - Last Modified Timestamp (update tracking)
 * - Compiler Metadata (compilation info)
 */
export interface EnterpriseKnowledgeObject {
  /**
   * Immutable Knowledge ID
   * Format: eko_<SHA-256>_v1
   * Deterministically generated from content
   */
  knowledgeId: string;

  /**
   * Knowledge content (the actual knowledge)
   */
  content: string;

  /**
   * Canonical name (human-readable identifier)
   */
  canonicalName: string;

  /**
   * Knowledge type (12 types defined in KnowledgeType enum)
   */
  type: KnowledgeType;

  /**
   * Knowledge classification (extracted, inferred, derived, observed, stated)
   */
  classification: KnowledgeClassification;

  /**
   * Semantic references to related concepts
   */
  semanticReferences?: {
    [key: string]: string;
  };

  /**
   * Source evidence reference
   */
  evidenceReference: {
    /**
     * Source Evidence ID
     */
    evidenceId: string;

    /**
     * Document reference
     */
    document?: string;

    /**
     * Interview reference
     */
    interview?: string;

    /**
     * Page number
     */
    page?: number;

    /**
     * Block index
     */
    block?: string;
  };

  /**
   * Source references (original document locations)
   */
  sourceReferences?: {
    document?: string;
    interview?: string;
    page?: number;
    block?: string;
    lineStart?: number;
    lineEnd?: number;
  };

  /**
   * Initial confidence level [0, 1]
   */
  confidence: KnowledgeConfidence;

  /**
   * Verification state (initially UNVERIFIED)
   */
  verificationState: VerificationState;

  /**
   * Lineage information (trace to source)
   */
  lineage: KnowledgeLineage;

  /**
   * Provenance information (complete history)
   */
  provenance: {
    /**
     * Who/what created this
     */
    creator: string;

    /**
     * When it was created
     */
    createdAt: string;

    /**
     * Creation method
     */
    method: string;

    /**
     * Any relevant notes
     */
    notes?: string;

    /**
     * Audit trail
     */
    auditTrail?: Array<{
      timestamp: string;
      action: string;
      actor?: string;
    }>;
  };

  /**
   * Owner/responsible party metadata
   */
  owner?: {
    /**
     * Owner name
     */
    name?: string;

    /**
     * Owner role
     */
    role?: string;

    /**
     * Owner contact
     */
    contact?: string;

    /**
     * Owner department/organization
     */
    organization?: string;
  };

  /**
   * Scope metadata (where applicable)
   */
  scope: KnowledgeScope;

  /**
   * Version metadata
   */
  version: KnowledgeVersion;

  /**
   * Creation timestamp (immutable)
   */
  createdAt: string;

  /**
   * Last modified timestamp
   */
  modifiedAt: string;

  /**
   * Compiler metadata
   */
  compiler: {
    /**
     * Compiler name
     */
    name: string;

    /**
     * Compiler version
     */
    version: string;

    /**
     * Compilation timestamp
     */
    timestamp: string;

    /**
     * Compilation stage
     */
    stage: string;

    /**
     * Processing duration (milliseconds)
     */
    processingTimeMs?: number;

    /**
     * Compiler instance ID
     */
    instanceId?: string;

    /**
     * Any diagnostics
     */
    diagnostics?: {
      [key: string]: unknown;
    };
  };
}

/**
 * Create an Enterprise Knowledge Object factory function
 */
export function createEnterpriseKnowledgeObject(
  overrides?: Partial<EnterpriseKnowledgeObject>
): EnterpriseKnowledgeObject {
  const now = new Date().toISOString();

  return {
    knowledgeId: '',
    content: '',
    canonicalName: '',
    type: 'capability' as KnowledgeType,
    classification: 'extracted' as KnowledgeClassification,
    evidenceReference: {
      evidenceId: '',
    },
    confidence: {
      initial: 0.5,
      current: 0.5,
    },
    verificationState: 'unverified' as VerificationState,
    lineage: {
      sourceEvidenceId: '',
      compilerVersion: '1.0.0',
      compiledAt: now,
      stage: 'evidence-compiler',
    },
    provenance: {
      creator: 'evidence-compiler',
      createdAt: now,
      method: 'evidence-extraction',
    },
    scope: {},
    version: {
      semver: '1.0.0',
      revision: 1,
      timestamp: now,
    },
    createdAt: now,
    modifiedAt: now,
    compiler: {
      name: 'evidence-compiler',
      version: '1.0.0',
      timestamp: now,
      stage: 'stage-2',
    },
    ...overrides,
  };
}
