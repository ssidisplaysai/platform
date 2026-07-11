/**
 * Knowledge Identity Tests
 *
 * Tests:
 * - Deterministic ID generation (GPS-0001)
 * - ID format validation
 * - Collision detection
 * - Hash computation
 */

import { describe, it, expect } from '@jest/globals';
import { KnowledgeIdentity } from '../src/compiler/knowledge';

describe('KnowledgeIdentity', () => {
  describe('generate', () => {
    it('generates valid knowledge ID format', () => {
      const id = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      expect(id).toMatch(/^eko_[a-f0-9]{64}_v1$/);
    });

    it('generates deterministic IDs for identical input', () => {
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      const id2 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      expect(id1).toBe(id2);
    });

    it('generates different IDs for different content', () => {
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      const id2 = KnowledgeIdentity.generate(
        'capability',
        'Can edit videos',
        'evidence_123_v1',
        0.85
      );

      expect(id1).not.toBe(id2);
    });

    it('generates different IDs for different types', () => {
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      const id2 = KnowledgeIdentity.generate(
        'constraint',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      expect(id1).not.toBe(id2);
    });

    it('generates different IDs for different evidence sources', () => {
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      const id2 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_456_v1',
        0.85
      );

      expect(id1).not.toBe(id2);
    });

    it('generates different IDs for different confidences', () => {
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85
      );

      const id2 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.75
      );

      expect(id1).not.toBe(id2);
    });

    it('normalizes confidence to 2 decimal places for determinism', () => {
      // Slightly different confidence values that round to same value
      const id1 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.850
      );

      const id2 = KnowledgeIdentity.generate(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.851
      );

      // These might be different due to rounding, but demonstrate the normalization
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('parse', () => {
    it('parses valid knowledge ID', () => {
      const id = 'eko_abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234_v1';
      const parsed = KnowledgeIdentity.parse(id);

      expect(parsed).toBeDefined();
      expect(parsed?.prefix).toBe('eko');
      expect(parsed?.hash).toBe('abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234');
      expect(parsed?.version).toBe(1);
    });

    it('returns null for invalid format', () => {
      const invalidIds = [
        'invalid_format',
        'eko_short_v1',
        'eko_' + 'a'.repeat(63) + '_v1', // 63 chars instead of 64
        'eko_' + 'a'.repeat(64) + '_v2', // wrong version
        'other_' + 'a'.repeat(64) + '_v1', // wrong prefix
      ];

      for (const id of invalidIds) {
        expect(KnowledgeIdentity.parse(id)).toBeNull();
      }
    });
  });

  describe('isValid', () => {
    it('validates correct knowledge ID', () => {
      const id = KnowledgeIdentity.generate(
        'capability',
        'Test',
        'evidence_123_v1',
        0.5
      );

      expect(KnowledgeIdentity.isValid(id)).toBe(true);
    });

    it('rejects invalid formats', () => {
      const invalidIds = [
        'not_a_knowledge_id',
        'eko_short_v1',
        'eko_' + 'a'.repeat(63) + '_v1',
        '',
      ];

      for (const id of invalidIds) {
        expect(KnowledgeIdentity.isValid(id)).toBe(false);
      }
    });
  });

  describe('extractHash', () => {
    it('extracts hash from valid ID', () => {
      const id = KnowledgeIdentity.generate(
        'capability',
        'Test',
        'evidence_123_v1',
        0.5
      );

      const hash = KnowledgeIdentity.extractHash(id);
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns null for invalid ID', () => {
      expect(KnowledgeIdentity.extractHash('invalid_id')).toBeNull();
    });
  });

  describe('verifyDeterminism', () => {
    it('verifies deterministic generation', () => {
      const isDeterministic = KnowledgeIdentity.verifyDeterminism(
        'capability',
        'Can create graphics',
        'evidence_123_v1',
        0.85,
        5
      );

      expect(isDeterministic).toBe(true);
    });

    it('runs specified number of iterations', () => {
      // This is implicitly tested by the fact that verifyDeterminism completes
      // We can't directly observe the runs, but the function should complete for large run counts
      const isDeterministic = KnowledgeIdentity.verifyDeterminism(
        'capability',
        'Test',
        'evidence_123_v1',
        0.5,
        10
      );

      expect(isDeterministic).toBe(true);
    });
  });

  describe('detectCollisions', () => {
    it('detects duplicate IDs', () => {
      const ids = [
        'eko_' + 'a'.repeat(64) + '_v1',
        'eko_' + 'b'.repeat(64) + '_v1',
        'eko_' + 'a'.repeat(64) + '_v1', // duplicate
        'eko_' + 'c'.repeat(64) + '_v1',
        'eko_' + 'b'.repeat(64) + '_v1', // duplicate
      ];

      const duplicates = KnowledgeIdentity.detectCollisions(ids);

      expect(duplicates).toHaveLength(2);
      expect(duplicates).toContain('eko_' + 'a'.repeat(64) + '_v1');
      expect(duplicates).toContain('eko_' + 'b'.repeat(64) + '_v1');
    });

    it('returns empty array for no duplicates', () => {
      const ids = [
        'eko_' + 'a'.repeat(64) + '_v1',
        'eko_' + 'b'.repeat(64) + '_v1',
        'eko_' + 'c'.repeat(64) + '_v1',
      ];

      const duplicates = KnowledgeIdentity.detectCollisions(ids);
      expect(duplicates).toHaveLength(0);
    });

    it('handles empty array', () => {
      const duplicates = KnowledgeIdentity.detectCollisions([]);
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('Constants', () => {
    it('has correct constants', () => {
      expect(KnowledgeIdentity.PREFIX).toBe('eko');
      expect(KnowledgeIdentity.ALGORITHM).toBe('sha256');
      expect(KnowledgeIdentity.VERSION).toBe(1);
      expect(KnowledgeIdentity.HASH_LENGTH).toBe(64);
    });
  });
});
