/**
 * Enterprise Knowledge Object Tests
 *
 * Tests:
 * - EnterpriseKnowledgeObject structure
 * - KnowledgeObjectBuilder API
 * - Validation rules
 * - Immutability
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  EnterpriseKnowledgeObject,
  createEnterpriseKnowledgeObject,
  KnowledgeObjectBuilder,
  KnowledgeType,
  KnowledgeClassification,
  VerificationState,
  KnowledgeIdentity,
} from '../src/compiler/knowledge';

describe('EnterpriseKnowledgeObject', () => {
  describe('createEnterpriseKnowledgeObject', () => {
    it('creates a valid EKO with default values', () => {
      const eko = createEnterpriseKnowledgeObject();

      expect(eko).toBeDefined();
      expect(eko.knowledgeId).toBeDefined();
      expect(eko.content).toBe('');
      expect(eko.canonicalName).toBe('');
      expect(eko.type).toBe(KnowledgeType.CAPABILITY);
      expect(eko.classification).toBe(KnowledgeClassification.EXTRACTED);
      expect(eko.verificationState).toBe(VerificationState.UNVERIFIED);
    });

    it('applies overrides correctly', () => {
      const now = new Date().toISOString();
      const eko = createEnterpriseKnowledgeObject({
        content: 'Test content',
        canonicalName: 'Test Name',
        type: KnowledgeType.CONSTRAINT,
        createdAt: now,
      });

      expect(eko.content).toBe('Test content');
      expect(eko.canonicalName).toBe('Test Name');
      expect(eko.type).toBe(KnowledgeType.CONSTRAINT);
      expect(eko.createdAt).toBe(now);
    });
  });

  describe('KnowledgeObjectBuilder', () => {
    let builder: KnowledgeObjectBuilder;

    beforeEach(() => {
      builder = new KnowledgeObjectBuilder();
    });

    it('builds a valid EKO with fluent API', () => {
      const eko = builder
        .setContent('Can create graphics')
        .setCanonicalName('Graphics Creation')
        .setType(KnowledgeType.CAPABILITY)
        .setClassification(KnowledgeClassification.EXTRACTED)
        .setEvidenceReference('evidence_123_v1')
        .setConfidence({
          initial: 0.85,
          current: 0.85,
        })
        .setLineage({
          sourceEvidenceId: 'evidence_123_v1',
          compilerVersion: '1.0.0',
          compiledAt: new Date().toISOString(),
          stage: 'stage-2',
        })
        .generateKnowledgeId()
        .build();

      expect(eko).toBeDefined();
      expect(eko.content).toBe('Can create graphics');
      expect(eko.canonicalName).toBe('Graphics Creation');
      expect(eko.type).toBe(KnowledgeType.CAPABILITY);
      expect(eko.knowledgeId).toBeDefined();
      expect(eko.knowledgeId).toMatch(/^eko_[a-f0-9]{64}_v1$/);
    });

    it('validates content is not empty', () => {
      expect(() => {
        builder.setContent('');
      }).toThrow('Content must be a non-empty string');

      expect(() => {
        builder.setContent('  '); // Only whitespace
      }).toThrow('Content must be a non-empty string');
    });

    it('validates canonical name is not empty', () => {
      expect(() => {
        builder.setCanonicalName('');
      }).toThrow('Canonical name must be a non-empty string');
    });

    it('validates knowledge type', () => {
      expect(() => {
        builder.setType('invalid_type' as KnowledgeType);
      }).toThrow('Invalid knowledge type');
    });

    it('validates confidence range [0, 1]', () => {
      expect(() => {
        builder.setConfidence({ initial: 1.5 });
      }).toThrow('Initial confidence must be in range [0, 1]');

      expect(() => {
        builder.setConfidence({ initial: -0.1 });
      }).toThrow('Initial confidence must be in range [0, 1]');
    });

    it('validates verification state', () => {
      expect(() => {
        builder.setVerificationState('invalid_state' as VerificationState);
      }).toThrow('Invalid verification state');
    });

    it('requires knowledgeId before build', () => {
      expect(() => {
        builder
          .setContent('Test')
          .setCanonicalName('Test')
          .setEvidenceReference('evidence_123_v1')
          .build();
      }).toThrow('knowledgeId is required');
    });

    it('requires content before build', () => {
      expect(() => {
        builder
          .setCanonicalName('Test')
          .setEvidenceReference('evidence_123_v1')
          .generateKnowledgeId()
          .build();
      }).toThrow('content is required');
    });

    it('generates deterministic knowledge IDs', () => {
      const eko1 = builder
        .setContent('Can create graphics')
        .setCanonicalName('Graphics Creation')
        .setType(KnowledgeType.CAPABILITY)
        .setEvidenceReference('evidence_123_v1')
        .setConfidence({ initial: 0.85, current: 0.85 })
        .setLineage({
          sourceEvidenceId: 'evidence_123_v1',
          compilerVersion: '1.0.0',
          compiledAt: '2026-07-01T00:00:00Z',
          stage: 'stage-2',
        })
        .generateKnowledgeId()
        .build();

      const builder2 = new KnowledgeObjectBuilder();
      const eko2 = builder2
        .setContent('Can create graphics')
        .setCanonicalName('Graphics Creation')
        .setType(KnowledgeType.CAPABILITY)
        .setEvidenceReference('evidence_123_v1')
        .setConfidence({ initial: 0.85, current: 0.85 })
        .setLineage({
          sourceEvidenceId: 'evidence_123_v1',
          compilerVersion: '1.0.0',
          compiledAt: '2026-07-01T00:00:00Z',
          stage: 'stage-2',
        })
        .generateKnowledgeId()
        .build();

      expect(eko1.knowledgeId).toBe(eko2.knowledgeId);
    });

    it('clones builder state', () => {
      const original = builder
        .setContent('Original')
        .setCanonicalName('Original Name')
        .setType(KnowledgeType.CONSTRAINT)
        .setEvidenceReference('evidence_123_v1')
        .setLineage({
          sourceEvidenceId: 'evidence_123_v1',
          compilerVersion: '1.0.0',
          compiledAt: new Date().toISOString(),
          stage: 'stage-2-evidence-compiler',
          tracePath: ['stage-1', 'stage-2'],
        })
        .generateKnowledgeId();

      const cloned = original.clone();
      cloned.setContent('Cloned');

      // Original should not be affected
      expect(original.build().content).toBe('Original');
      expect(cloned.build().content).toBe('Cloned');
    });

    it('resets builder state', () => {
      const eko1 = builder
        .setContent('First')
        .setCanonicalName('First Name')
        .setEvidenceReference('evidence_123_v1')
        .setLineage({
          sourceEvidenceId: 'evidence_123_v1',
          compilerVersion: '1.0.0',
          compiledAt: new Date().toISOString(),
          stage: 'stage-2-evidence-compiler',
          tracePath: ['stage-1', 'stage-2'],
        })
        .generateKnowledgeId()
        .build();

      builder.reset();

      const eko2 = builder
        .setContent('Second')
        .setCanonicalName('Second Name')
        .setEvidenceReference('evidence_456_v1')
        .setLineage({
          sourceEvidenceId: 'evidence_456_v1',
          compilerVersion: '1.0.0',
          compiledAt: new Date().toISOString(),
          stage: 'stage-2-evidence-compiler',
          tracePath: ['stage-1', 'stage-2'],
        })
        .generateKnowledgeId()
        .build();

      expect(eko1.content).toBe('First');
      expect(eko2.content).toBe('Second');
      expect(eko1.knowledgeId).not.toBe(eko2.knowledgeId);
    });
  });
});
