/**
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - EKM-1.0 Enterprise Knowledge Model
 */

import {
  EnterpriseKnowledgeObject,
  createEnterpriseKnowledgeObject,
} from './EnterpriseKnowledgeObject';
import {
  KnowledgeType,
} from './KnowledgeType';
import {
  KnowledgeClassification,
  VerificationState,
  isValidConfidence,
  KnowledgeScope,
  KnowledgeConfidence,
  KnowledgeLineage,
  KnowledgeVersion,
} from './KnowledgeClassification';
import { KnowledgeIdentity } from './KnowledgeIdentity';

/**
 * Knowledge Object Builder
 *
 * Fluent API for constructing Enterprise Knowledge Objects with validation
 * and deterministic identity generation.
 */
export class KnowledgeObjectBuilder {
  private eko: EnterpriseKnowledgeObject;

  constructor() {
    this.eko = createEnterpriseKnowledgeObject();
  }

  /**
   * Set knowledge content
   */
  setContent(content: string): this {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Content must be a non-empty string');
    }
    this.eko.content = trimmed;
    return this;
  }

  /**
   * Set canonical name
   */
  setCanonicalName(name: string): this {
    if (!name || typeof name !== 'string') {
      throw new Error('Canonical name must be a non-empty string');
    }
    this.eko.canonicalName = name.trim();
    return this;
  }

  /**
   * Set knowledge type
   */
  setType(type: KnowledgeType): this {
    if (!Object.values(KnowledgeType).includes(type)) {
      throw new Error(`Invalid knowledge type: ${type}`);
    }
    this.eko.type = type;
    return this;
  }

  /**
   * Set knowledge classification
   */
  setClassification(classification: KnowledgeClassification): this {
    if (!Object.values(KnowledgeClassification).includes(classification)) {
      throw new Error(`Invalid classification: ${classification}`);
    }
    this.eko.classification = classification;
    return this;
  }

  /**
   * Set evidence reference
   */
  setEvidenceReference(
    evidenceId: string,
    metadata?: Record<string, unknown>
  ): this {
    if (!evidenceId || typeof evidenceId !== 'string') {
      throw new Error('Evidence ID must be a non-empty string');
    }
    this.eko.evidenceReference = {
      evidenceId,
      ...(metadata as Record<string, unknown>),
    };
    return this;
  }

  /**
   * Set source references
   */
  setSourceReferences(
    sources: Record<string, unknown>
  ): this {
    this.eko.sourceReferences = sources as Record<string, unknown>;
    return this;
  }

  /**
   * Set confidence
   */
  setConfidence(confidence: Partial<KnowledgeConfidence>): this {
    if (confidence.initial !== undefined && !isValidConfidence(confidence.initial)) {
      throw new Error('Initial confidence must be in range [0, 1]');
    }
    if (confidence.current !== undefined && !isValidConfidence(confidence.current)) {
      throw new Error('Current confidence must be in range [0, 1]');
    }

    this.eko.confidence = {
      ...this.eko.confidence,
      ...confidence,
    };
    return this;
  }

  /**
   * Set verification state
   */
  setVerificationState(state: VerificationState): this {
    if (!Object.values(VerificationState).includes(state)) {
      throw new Error(`Invalid verification state: ${state}`);
    }
    this.eko.verificationState = state;
    return this;
  }

  /**
   * Set lineage
   */
  setLineage(lineage: Partial<KnowledgeLineage>): this {
    this.eko.lineage = {
      ...this.eko.lineage,
      ...lineage,
    };
    return this;
  }

  /**
   * Set provenance
   */
  setProvenance(provenance: Partial<typeof this.eko.provenance>): this {
    this.eko.provenance = {
      ...this.eko.provenance,
      ...provenance,
    };
    return this;
  }

  /**
   * Set owner
   */
  setOwner(owner: Partial<typeof this.eko.owner>): this {
    this.eko.owner = {
      ...this.eko.owner,
      ...owner,
    };
    return this;
  }

  /**
   * Set scope
   */
  setScope(scope: KnowledgeScope): this {
    this.eko.scope = scope;
    return this;
  }

  /**
   * Set version
   */
  setVersion(version: Partial<KnowledgeVersion>): this {
    this.eko.version = {
      ...this.eko.version,
      ...version,
    };
    return this;
  }

  /**
   * Set compiler metadata
   */
  setCompilerMetadata(compiler: Partial<typeof this.eko.compiler>): this {
    this.eko.compiler = {
      ...this.eko.compiler,
      ...compiler,
    };
    return this;
  }

  /**
   * Generate deterministic knowledge ID
   *
   * Uses GPS-0001 standard to generate content-addressed ID.
   * Must be called before build() to generate the ID.
   */
  generateKnowledgeId(): this {
    const knowledgeId = KnowledgeIdentity.generate(
      this.eko.type,
      this.eko.content,
      this.eko.evidenceReference.evidenceId,
      this.eko.confidence.initial
    );

    this.eko.knowledgeId = knowledgeId;
    return this;
  }

  /**
   * Validate the Knowledge Object
   *
   * @throws Error if validation fails
   */
  private validate(): void {
    const errors: string[] = [];

    // Required fields
    if (!this.eko.knowledgeId) {
      errors.push('knowledgeId is required (call generateKnowledgeId() first)');
    }

    if (!this.eko.content) {
      errors.push('content is required');
    }

    if (!this.eko.canonicalName) {
      errors.push('canonicalName is required');
    }

    if (!Object.values(KnowledgeType).includes(this.eko.type)) {
      errors.push(`type is invalid: ${this.eko.type}`);
    }

    if (!Object.values(KnowledgeClassification).includes(this.eko.classification)) {
      errors.push(`classification is invalid: ${this.eko.classification}`);
    }

    // Validate ID format
    if (this.eko.knowledgeId && !KnowledgeIdentity.isValid(this.eko.knowledgeId)) {
      errors.push(`knowledgeId format is invalid: ${this.eko.knowledgeId}`);
    }

    // Validate confidence
    if (!isValidConfidence(this.eko.confidence.initial)) {
      errors.push('confidence.initial must be in range [0, 1]');
    }

    if (!isValidConfidence(this.eko.confidence.current)) {
      errors.push('confidence.current must be in range [0, 1]');
    }

    // Validate verification state
    if (!Object.values(VerificationState).includes(this.eko.verificationState)) {
      errors.push(`verificationState is invalid: ${this.eko.verificationState}`);
    }

    // Validate lineage
    if (!this.eko.lineage.sourceEvidenceId) {
      errors.push('lineage.sourceEvidenceId is required');
    }

    // Validate evidence reference
    if (!this.eko.evidenceReference.evidenceId) {
      errors.push('evidenceReference.evidenceId is required');
    }

    if (errors.length > 0) {
      throw new Error(`Knowledge Object validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Build and return the Enterprise Knowledge Object
   *
   * @returns Complete, validated Enterprise Knowledge Object
   * @throws Error if validation fails
   */
  build(): EnterpriseKnowledgeObject {
    this.validate();

    // Deep copy to prevent external modifications
    return JSON.parse(JSON.stringify(this.eko));
  }

  /**
   * Clone the current builder state
   */
  clone(): KnowledgeObjectBuilder {
    const cloned = new KnowledgeObjectBuilder();
    cloned.eko = JSON.parse(JSON.stringify(this.eko));
    return cloned;
  }

  /**
   * Reset builder to empty state
   */
  reset(): this {
    this.eko = createEnterpriseKnowledgeObject();
    return this;
  }
}
