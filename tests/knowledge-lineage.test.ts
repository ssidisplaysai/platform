/**
 * Knowledge Lineage and Provenance Tests
 *
 * Tests:
 * - Lineage preservation through compilation
 * - Provenance tracking
 * - Audit trails
 * - Source reference tracking
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
  id: string = 'evidence_test_v1',
  overrides?: Partial<EvidenceItem>
): EvidenceItem {
  const now = new Date().toISOString();
  const baseItem: EvidenceItem = {
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
      discoveryInterviewId: 'interview_zach_001',
      discoverySourceMetadata: {
        participant: 'Zach Anderson',
        role: 'Graphics Lead',
        department: 'Design',
        interviewDate: now,
        interviewer: 'Interviewer Name',
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

  return { ...baseItem, ...overrides };
}

describe('Knowledge Lineage and Provenance', () => {
  let compiler: EvidenceCompiler;

  beforeEach(() => {
    compiler = new EvidenceCompiler('1.0.0');
  });

  describe('Lineage Preservation', () => {
    it('preserves complete lineage from evidence', () => {
      const evidence = createMockEvidenceItem('Can create graphics', 'capability');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.lineage).toBeDefined();
      expect(eko.lineage.sourceEvidenceId).toBe(evidence.metadata.identity);
      expect(eko.lineage.tracePath).toContain('stage-1-discovery');
      expect(eko.lineage.tracePath).toContain('stage-2-evidence-compiler');
    });

    it('tracks compiler version in lineage', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.lineage.compilerVersion).toBe('1.0.0');
    });

    it('records compilation timestamp in lineage', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.lineage.compiledAt).toBeDefined();
      const timestamp = new Date(eko.lineage.compiledAt);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('identifies correct compilation stage in lineage', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.lineage.stage).toBe('stage-2-evidence-compiler');
    });
  });

  describe('Provenance Tracking', () => {
    it('records creator in provenance', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance.creator).toBe('evidence-compiler');
    });

    it('records creation timestamp in provenance', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance.createdAt).toBeDefined();
      const timestamp = new Date(eko.provenance.createdAt);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('records transformation method in provenance', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance.method).toBe('evidence-to-eko-transformation');
    });

    it('includes notes about source in provenance', () => {
      const evidence = createMockEvidenceItem('Test', 'capability');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance.notes).toBeDefined();
      expect(eko.provenance.notes).toContain('Evidence IR form type');
      expect(eko.provenance.notes).toContain('capability');
    });
  });

  describe('Audit Trail', () => {
    it('creates audit trail entry on creation', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.provenance.auditTrail).toBeDefined();
      expect(eko.provenance.auditTrail).toHaveLength(1);
      expect(eko.provenance.auditTrail?.[0].action).toBe('created');
      expect(eko.provenance.auditTrail?.[0].actor).toBe('evidence-compiler');
    });

    it('audit trail entries have timestamps', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      const entry = eko.provenance.auditTrail?.[0];
      expect(entry).toBeDefined();
      expect(entry?.timestamp).toBeDefined();

      const timestamp = new Date(entry!.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Source References', () => {
    it('preserves document source reference', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.sourceReferences?.document).toBe('Zach Anderson');
    });

    it('preserves interview source reference', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.sourceReferences?.interview).toBe('interview_zach_001');
    });

    it('preserves page number source reference', () => {
      const evidence = createMockEvidenceItem('Test', 'statement', 'evidence_1', {
        provenance: {
          discoveryQuestionId: 'q1',
          discoveryAnswerId: 'a1',
          discoverySectionId: 's1',
          discoveryInterviewId: 'interview_test',
          discoverySourceMetadata: {},
          sourcePage: 5,
          sourceOffset: 0,
          sourceLength: 4,
          discoveryVersion: '1.0.0',
          evidenceIRCompilerVersion: '1.0.0',
          evidenceIRSchemaVersion: '1.0.0',
          compiledAt: new Date().toISOString(),
        },
      });

      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.sourceReferences?.page).toBe(5);
    });

    it('records evidence reference', () => {
      const evidence = createMockEvidenceItem('Test', 'statement', 'evidence_xyz_v1');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.evidenceReference.evidenceId).toBe('evidence_xyz_v1');
    });
  });

  describe('Owner and Scope Metadata', () => {
    it('preserves owner role from evidence', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.owner?.role).toBe('Graphics Lead');
    });

    it('preserves owner organization from evidence', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.owner?.organization).toBe('Design');
    });

    it('sets scope organization from evidence', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.scope.organization).toBe('Design');
    });

    it('sets scope role from evidence', () => {
      const evidence = createMockEvidenceItem('Test', 'statement');
      const result = compiler.compile([evidence]);
      const eko = result.ekos[0];

      expect(eko.scope.role).toBe('Graphics Lead');
    });
  });

  describe('Multiple Evidence Items', () => {
    it('maintains separate lineage for each EKO', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement', 'evidence_1_v1'),
        createMockEvidenceItem('Test 2', 'constraint', 'evidence_2_v1'),
        createMockEvidenceItem('Test 3', 'decision', 'evidence_3_v1'),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.ekos).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        const eko = result.ekos[i];
        const evidence = evidenceItems[i];

        expect(eko.lineage.sourceEvidenceId).toBe(evidence.metadata.identity);
      }
    });

    it('maintains separate source references for each EKO', () => {
      const evidenceItems = [
        createMockEvidenceItem('Test 1', 'statement', 'evidence_1_v1', {
          provenance: {
            discoveryQuestionId: 'q1',
            discoveryAnswerId: 'a1',
            discoverySectionId: 's1',
            discoveryInterviewId: 'interview_1',
            discoverySourceMetadata: { participant: 'Zach' },
            sourcePage: 1,
            sourceOffset: 0,
            sourceLength: 6,
            discoveryVersion: '1.0.0',
            evidenceIRCompilerVersion: '1.0.0',
            evidenceIRSchemaVersion: '1.0.0',
            compiledAt: new Date().toISOString(),
          },
        }),
        createMockEvidenceItem('Test 2', 'statement', 'evidence_2_v1', {
          provenance: {
            discoveryQuestionId: 'q2',
            discoveryAnswerId: 'a2',
            discoverySectionId: 's2',
            discoveryInterviewId: 'interview_2',
            discoverySourceMetadata: { participant: 'Madison' },
            sourcePage: 2,
            sourceOffset: 0,
            sourceLength: 6,
            discoveryVersion: '1.0.0',
            evidenceIRCompilerVersion: '1.0.0',
            evidenceIRSchemaVersion: '1.0.0',
            compiledAt: new Date().toISOString(),
          },
        }),
      ];

      const result = compiler.compile(evidenceItems);

      expect(result.ekos[0].sourceReferences?.document).toBe('Zach');
      expect(result.ekos[1].sourceReferences?.document).toBe('Madison');
      expect(result.ekos[0].sourceReferences?.page).toBe(1);
      expect(result.ekos[1].sourceReferences?.page).toBe(2);
    });
  });
});
