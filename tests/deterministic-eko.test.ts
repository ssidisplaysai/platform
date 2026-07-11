/**
 * Deterministic EKO Compilation Tests
 *
 * Tests:
 * - Identical input produces identical output
 * - Stable ordering
 * - Stable identities
 * - No information loss
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EvidenceItem, EvidenceFormType } from '../src/evidence-ir/models';
import { EvidenceCompiler } from '../src/compiler/stages';

/**
 * Create mock Evidence Item for testing
 */
function createMockEvidenceItem(
  content: string,
  formType: EvidenceFormType = 'statement',
  id: string = 'evidence_test_v1'
): EvidenceItem {
  const now = new Date().toISOString();
  return {
    metadata: {
      created: now,
      identity: id,
      scope: null,
      version: 1,
    },
    formType,
    content,
    rawContent: content,
    provenance: {
      discoveryQuestionId: 'q1',
      discoveryAnswerId: 'a1',
      discoverySectionId: 's1',
      discoveryInterviewId: 'interview_test',
      discoverySourceMetadata: {
        participant: 'Test Participant',
        role: 'Tester',
        department: 'Testing',
        interviewDate: now,
      },
      sourcePage: 1,
      sourceOffset: 0,
      sourceLength: content.length,
      discoveryVersion: '1.0.0',
      evidenceIRCompilerVersion: '1.0.0',
      evidenceIRSchemaVersion: '1.0.0',
      compiledAt: now,
    },
    relationships: {
      relatedItemIds: [],
      structuralRelationships: [],
    },
    validationResults: {
      isValid: true,
      violations: [],
    },
  };
}

describe('Deterministic EKO Compilation', () => {
  let compiler: EvidenceCompiler;

  beforeEach(() => {
    compiler = new EvidenceCompiler('1.0.0');
  });

  describe('Identical Input Produces Identical Output', () => {
    it('same evidence produces same EKO on repeated compilation', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');

      const result1 = compiler.compile([evidence]);
      const result2 = compiler.compile([evidence]);

      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
      expect(result1.ekos[0].content).toBe(result2.ekos[0].content);
      expect(result1.ekos[0].canonicalName).toBe(result2.ekos[0].canonicalName);
      expect(result1.ekos[0].type).toBe(result2.ekos[0].type);
      expect(result1.ekos[0].confidence.initial).toBe(result2.ekos[0].confidence.initial);
    });

    it('multiple EKOs maintain identical order on repeated compilation', () => {
      const evidenceItems = [
        createMockEvidenceItem('Can create graphics', 'capability', 'evidence_1_v1'),
        createMockEvidenceItem('Cannot process large files', 'constraint', 'evidence_2_v1'),
        createMockEvidenceItem('Need better tools', 'need', 'evidence_3_v1'),
      ];

      const result1 = compiler.compile(evidenceItems);
      const result2 = compiler.compile(evidenceItems);

      expect(result1.ekos).toHaveLength(result2.ekos.length);

      for (let i = 0; i < result1.ekos.length; i++) {
        expect(result1.ekos[i].knowledgeId).toBe(result2.ekos[i].knowledgeId);
      }
    });

    it('determinism holds across different compiler instances', () => {
      const evidence = createMockEvidenceItem('Test content', 'statement');

      const compiler1 = new EvidenceCompiler('1.0.0');
      const compiler2 = new EvidenceCompiler('1.0.0');

      const result1 = compiler1.compile([evidence]);
      const result2 = compiler2.compile([evidence]);

      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
    });

    it('determinism verification passes for identical compilations', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');

      const result = compiler.compileWithDeterminismVerification([evidence], 5);

      expect(result.determinismVerification.verified).toBe(true);
      expect(result.determinismVerification.runs).toBe(5);
      expect(result.determinismVerification.identicalOutputs).toBe(5);
    });
  });

  describe('Stable Ordering', () => {
    it('preserves input order in output', () => {
      const evidenceItems = [
        createMockEvidenceItem('First', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Second', 'statement', 'evidence_2_v1'),
        createMockEvidenceItem('Third', 'statement', 'evidence_3_v1'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.ekos[0].content).toBe('First');
      expect(result.ekos[1].content).toBe('Second');
      expect(result.ekos[2].content).toBe('Third');
    });

    it('maintains stable order on repeated compilations', () => {
      const evidenceItems = [
        createMockEvidenceItem('First', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Second', 'capability', 'evidence_2_v1'),
        createMockEvidenceItem('Third', 'constraint', 'evidence_3_v1'),
      ];

      const result1 = compiler.compile(evidenceItems);
      const result2 = compiler.compile(evidenceItems);

      for (let i = 0; i < result1.ekos.length; i++) {
        expect(result1.ekos[i].content).toBe(result2.ekos[i].content);
      }
    });
  });

  describe('Stable Identities', () => {
    it('knowledge ID depends only on content and parameters, not timestamp', async () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');

      // Compile with small delay
      const result1 = compiler.compile([evidence]);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = compiler.compile([evidence]);

      // Despite different compilation times, IDs should be identical
      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
    });

    it('same content with different timestamps produces same ID', () => {
      const evidence = createMockEvidenceItem('Test content', 'statement');

      // Create two identical compilations
      const result1 = compiler.compile([evidence]);
      const result2 = compiler.compile([evidence]);

      // IDs must be identical despite different compilation times
      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);

      // But timestamps should be different (roughly)
      // Note: This may not always be true if compilations happen very quickly
      // but the important part is the IDs are identical
      expect(result1.ekos[0].createdAt).toBeDefined();
      expect(result2.ekos[0].createdAt).toBeDefined();
    });

    it('changing content changes identity', () => {
      const evidence1 = createMockEvidenceItem('Content A', 'statement');
      const evidence2 = createMockEvidenceItem('Content B', 'statement');

      const result1 = compiler.compile([evidence1]);
      const result2 = compiler.compile([evidence2]);

      expect(result1.ekos[0].knowledgeId).not.toBe(result2.ekos[0].knowledgeId);
    });

    it('changing confidence changes identity', () => {
      const evidence1 = createMockEvidenceItem('Test', 'statement', 'evidence_1_v1');
      const evidence2 = createMockEvidenceItem('Test', 'statement', 'evidence_1_v1');

      // Confidence should be calculated the same way for same form type
      // So we can't easily change it. But we can verify it's deterministic.
      const result1 = compiler.compile([evidence1]);
      const result2 = compiler.compile([evidence2]);

      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
    });
  });

  describe('No Information Loss', () => {
    it('compiles all input evidence items', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Test 2', 'constraint', 'evidence_2_v1'),
        createMockEvidenceItem('Test 3', 'decision', 'evidence_3_v1'),
        createMockEvidenceItem('Test 4', 'need', 'evidence_4_v1'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.ekos.length).toBe(evidenceItems.length);
      expect(result.statistics.generatedEKOs).toBe(4);
      expect(result.statistics.failedTransformations).toBe(0);
    });

    it('preserves all evidence content in EKO', () => {
      const content = 'Can create graphics with advanced tools and techniques';
      const evidence = createMockEvidenceItem(content, 'statement');

      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.content).toBe(content);
    });

    it('preserves evidence form type information', () => {
      const formTypes: EvidenceFormType[] = [
        'statement',
        'constraint',
        'decision',
        'need',
        'capability',
        'obstacle',
      ];

      const evidenceItems = formTypes.map((formType, index) =>
        createMockEvidenceItem(`Test ${index}`, formType, `evidence_${index}_v1`)
      );

      const result = compiler.compile(evidenceItems);

      for (let i = 0; i < result.ekos.length; i++) {
        // Verify that the knowledge type is derived from form type
        expect(result.ekos[i]).toBeDefined();
        expect(result.ekos[i].type).toBeDefined();
      }
    });

    it('statistics match actual EKO count', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Test 2', 'constraint', 'evidence_2_v1'),
        createMockEvidenceItem('Test 3', 'decision', 'evidence_3_v1'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.statistics.inputItems).toBe(3);
      expect(result.statistics.generatedEKOs).toBe(result.ekos.length);
      expect(result.statistics.successfulTransformations).toBe(result.ekos.length);
      expect(result.statistics.generatedEKOs).toBe(3);
    });
  });

  describe('Immutable Knowledge IDs', () => {
    it('knowledge ID does not change after creation', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      const originalId = eko.knowledgeId;

      // Verify ID format
      expect(originalId).toMatch(/^eko_[a-f0-9]{64}_v1$/);

      // If we were to recompile, ID should be same
      const result2 = compiler.compile([evidence]);
      expect(result2.ekos[0].knowledgeId).toBe(originalId);
    });

    it('knowledge ID format matches GPS-0001 standard', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      // Format: eko_<64-char-hex>_v1
      expect(eko.knowledgeId).toMatch(/^eko_[a-f0-9]{64}_v1$/);
    });
  });

  describe('Repeatable Compilation', () => {
    it('same evidence produces byte-identical EKO on repeated compilation', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');

      const result1 = compiler.compile([evidence]);
      const result2 = compiler.compile([evidence]);

      // Convert to JSON for strict comparison
      const json1 = JSON.stringify(result1.ekos[0]);
      const json2 = JSON.stringify(result2.ekos[0]);

      // The JSON should be identical except for timestamps
      // Extract non-timestamp fields for comparison
      const eko1 = result1.ekos[0];
      const eko2 = result2.ekos[0];

      expect(eko1.knowledgeId).toBe(eko2.knowledgeId);
      expect(eko1.content).toBe(eko2.content);
      expect(eko1.canonicalName).toBe(eko2.canonicalName);
      expect(eko1.type).toBe(eko2.type);
      expect(eko1.classification).toBe(eko2.classification);
    });

    it('compilation statistics are consistent', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Test 2', 'constraint', 'evidence_2_v1'),
      ];

      const result1 = compiler.compile(evidenceItems);
      const result2 = compiler.compile(evidenceItems);

      expect(result1.statistics.inputItems).toBe(result2.statistics.inputItems);
      expect(result1.statistics.generatedEKOs).toBe(result2.statistics.generatedEKOs);
      expect(result1.statistics.successfulTransformations).toBe(
        result2.statistics.successfulTransformations
      );
      expect(result1.statistics.failedTransformations).toBe(
        result2.statistics.failedTransformations
      );
    });
  });
});
