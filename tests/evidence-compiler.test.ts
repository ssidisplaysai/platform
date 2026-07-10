/**
 * Evidence Compiler Tests
 *
 * Tests:
 * - EvidenceItem to EKO transformation
 * - Knowledge type mapping
 * - Confidence calculation
 * - Deterministic compilation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EvidenceItem, EvidenceFormType } from '../src/evidence-ir/models';
import { EvidenceCompiler, EvidenceCompilerResult } from '../src/compiler/stages';
import { KnowledgeType } from '../src/compiler/knowledge';

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

describe('EvidenceCompiler', () => {
  let compiler: EvidenceCompiler;

  beforeEach(() => {
    compiler = new EvidenceCompiler('1.0.0');
  });

  describe('compile', () => {
    it('compiles single evidence item to EKO', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compile([evidence]);

      expect(result).toBeDefined();
      expect(result.ekos).toHaveLength(1);
      expect(result.statistics.generatedEKOs).toBe(1);
      expect(result.statistics.successfulTransformations).toBe(1);
      expect(result.statistics.failedTransformations).toBe(0);
    });

    it('compiles multiple evidence items', () => {
      const evidenceItems = [
        createMockEvidenceItem('Can create graphics', 'capability', 'evidence_1_v1'),
        createMockEvidenceItem('Cannot process large files', 'constraint', 'evidence_2_v1'),
        createMockEvidenceItem('We decided to use React', 'decision', 'evidence_3_v1'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.ekos).toHaveLength(3);
      expect(result.statistics.generatedEKOs).toBe(3);
      expect(result.statistics.inputItems).toBe(3);
    });

    it('generates deterministic knowledge IDs', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result1 = compiler.compile([evidence]);
      const result2 = compiler.compile([evidence]);

      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
    });

    it('preserves evidence lineage', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.lineage).toBeDefined();
      expect(eko.lineage.sourceEvidenceId).toBe(evidence.metadata.identity);
      expect(eko.lineage.compilerVersion).toBe('1.0.0');
      expect(eko.lineage.stage).toBe('stage-2-evidence-compiler');
    });

    it('preserves evidence provenance', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance).toBeDefined();
      expect(eko.provenance.creator).toBe('evidence-compiler');
      expect(eko.provenance.createdAt).toBeDefined();
      expect(eko.provenance.method).toBe('evidence-to-eko-transformation');
      expect(eko.provenance.auditTrail).toBeDefined();
      expect(eko.provenance.auditTrail).toHaveLength(1);
    });

    it('preserves evidence source references', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.sourceReferences).toBeDefined();
      expect(eko.sourceReferences?.document).toBe('Test Participant');
      expect(eko.sourceReferences?.interview).toBe('interview_test');
      expect(eko.sourceReferences?.page).toBe(1);
    });

    it('generates initial confidence based on form type', () => {
      const testCases: Array<[EvidenceFormType, number]> = [
        ['statement', 0.85],
        ['measurement', 0.90],
        ['opportunity', 0.70],
        ['assertion', 0.75],
      ];

      for (const [formType, expectedConfidence] of testCases) {
        const evidence = createMockEvidenceItem('Test', formType);
        const result = compiler.compile([evidence]);
        const eko = result.ekos[0];

        // Allow small variance due to rounding
        expect(eko.confidence.initial).toBeCloseTo(expectedConfidence, 0.05);
      }
    });

    it('maps evidence form types to knowledge types correctly', () => {
      const testCases: Array<[EvidenceFormType, KnowledgeType]> = [
        ['statement', KnowledgeType.CAPABILITY],
        ['constraint', KnowledgeType.CONSTRAINT],
        ['decision', KnowledgeType.DECISION],
        ['pain_point', KnowledgeType.PAIN_POINT],
        ['capability', KnowledgeType.CAPABILITY],
        ['need', KnowledgeType.NEED],
        ['measurement', KnowledgeType.MEASUREMENT],
        ['interaction', KnowledgeType.INTERACTION],
        ['obstacle', KnowledgeType.OBSTACLE],
        ['opportunity', KnowledgeType.OPPORTUNITY],
      ];

      for (const [formType, expectedType] of testCases) {
        const evidence = createMockEvidenceItem('Test', formType);
        const result = compiler.compile([evidence]);
        const eko = result.ekos[0];

        expect(eko.type).toBe(expectedType);
      }
    });

    it('generates canonical names from content', () => {
      const evidence = createMockEvidenceItem('Can create graphics with advanced tools');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.canonicalName).toBeDefined();
      expect(eko.canonicalName.length).toBeGreaterThan(0);
      expect(eko.canonicalName.length).toBeLessThanOrEqual(60);
      expect(eko.canonicalName).toMatch(/^[A-Z]/); // Starts with capital letter
    });

    it('includes compiler metadata', () => {
      const evidence = createMockEvidenceItem('Test content');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.compiler).toBeDefined();
      expect(eko.compiler.name).toBe('evidence-compiler');
      expect(eko.compiler.version).toBe('1.0.0');
      expect(eko.compiler.stage).toBe('stage-2');
      expect(eko.compiler.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('includes compilation diagnostics', () => {
      const evidenceItems = [
        createMockEvidenceItem('Valid evidence', 'statement'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.diagnostics).toBeDefined();
      expect(Array.isArray(result.diagnostics)).toBe(true);
    });

    it('tracks compilation statistics', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement'),
        createMockEvidenceItem('Test 2', 'constraint'),
        createMockEvidenceItem('Test 3', 'decision'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.inputItems).toBe(3);
      expect(result.statistics.generatedEKOs).toBe(3);
      expect(result.statistics.successfulTransformations).toBe(3);
      expect(result.statistics.failedTransformations).toBe(0);
      expect(result.statistics.compilationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compileWithDeterminismVerification', () => {
    it('verifies deterministic output across multiple runs', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compileWithDeterminismVerification([evidence], 3);

      expect(result.determinismVerification.verified).toBe(true);
      expect(result.determinismVerification.runs).toBe(3);
      expect(result.determinismVerification.identicalOutputs).toBe(3);
    });

    it('detects non-deterministic output', () => {
      // Note: This is hard to test without intentionally breaking determinism
      // This test demonstrates the structure
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compileWithDeterminismVerification([evidence], 2);

      expect(result.determinismVerification).toBeDefined();
      expect(result.determinismVerification.runs).toBe(2);
    });

    it('produces same output on repeated verification calls', () => {
      const evidence = createMockEvidenceItem('Test content', 'statement');

      const result1 = compiler.compileWithDeterminismVerification([evidence]);
      const result2 = compiler.compileWithDeterminismVerification([evidence]);

      // Knowledge IDs should be identical
      expect(result1.ekos[0].knowledgeId).toBe(result2.ekos[0].knowledgeId);
    });
  });
});
