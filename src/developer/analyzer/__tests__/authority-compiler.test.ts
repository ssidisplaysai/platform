/**
 * authority-compiler.test.ts
 * Comprehensive tests for the Authority Compiler.
 *
 * Tests cover:
 * - Authority matrix generation
 * - Authority precedence ordering
 * - Duplicate content detection across authorities
 * - Deterministic compilation
 * - Immutability of authority matrices
 * - Authority statistics and accounting
 */

import { expect, describe, test } from '@jest/globals';
import { AuthorityCompiler } from '../AuthorityCompiler';
import type { RepositoryDocument } from '../models/RepositoryDocument';
import { AuthorityLevel, createAuthority } from '../models/Authority';

describe('AuthorityCompiler', () => {
  /**
   * Helper to create test documents with specified authority.
   */
  function createTestDocument(
    path: string,
    authorityLevel: string,
    content: string = 'test content',
  ): RepositoryDocument {
    const authority = createAuthority(authorityLevel as AuthorityLevel);
    return {
      id: `doc_${path.replace(/[^a-z0-9]/g, '_')}_v1`,
      path,
      absolutePath: `/repo/${path}`,
      extension: path.split('.').pop() ? `.${path.split('.').pop()}` : '',
      nameWithoutExtension: path.split('/').pop()?.split('.')[0] || '',
      fileName: path.split('/').pop() || '',
      parentDirectory: path.substring(0, path.lastIndexOf('/')),
      content,
      sizeBytes: content.length,
      lineCount: content.split('\n').length,
      contentChecksum: `sha256_${content.length}`,
      authority,
      isFrozen: true,
      title: null,
      description: null,
      version: null,
      status: null,
      referencedDocumentIds: [],
      externalReferences: [],
      tags: [],
      extractedAt: new Date().toISOString(),
      metadataChecksum: 'sha256',
    };
  }

  test('creates authority matrix from classified documents', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('constitution.md', AuthorityLevel.CONSTITUTIONAL),
      createTestDocument('standard.md', AuthorityLevel.NORMATIVE),
      createTestDocument('architecture.md', AuthorityLevel.ARCHITECTURAL),
      createTestDocument('guidance.md', AuthorityLevel.GUIDANCE),
      createTestDocument('info.md', AuthorityLevel.INFORMATIONAL),
    ];

    const matrix = compiler.compile('/repo', documents);

    expect(matrix.id).toBeDefined();
    expect(matrix.totalDocumentCount).toBe(5);
    expect(matrix.authorityCount).toBe(5);
    expect(matrix.entries.length).toBe(5);
  });

  test('organizes documents in authority precedence order', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('info.md', AuthorityLevel.INFORMATIONAL),
      createTestDocument('constitution.md', AuthorityLevel.CONSTITUTIONAL),
      createTestDocument('guidance.md', AuthorityLevel.GUIDANCE),
      createTestDocument('arch.md', AuthorityLevel.ARCHITECTURAL),
      createTestDocument('norm.md', AuthorityLevel.NORMATIVE),
    ];

    const matrix = compiler.compile('/repo', documents);

    // Should be in precedence order: Constitutional → Normative → Architectural → Guidance → Informational
    const levels = matrix.entries.map(e => e.authority.level);
    expect(levels).toEqual([
      AuthorityLevel.CONSTITUTIONAL,
      AuthorityLevel.NORMATIVE,
      AuthorityLevel.ARCHITECTURAL,
      AuthorityLevel.GUIDANCE,
      AuthorityLevel.INFORMATIONAL,
    ]);
  });

  test('detects duplicate content across authority levels', () => {
    const compiler = new AuthorityCompiler();

    // Same content at different authority levels
    const sameContent = 'duplicated content';
    const documents: RepositoryDocument[] = [
      createTestDocument('constitutional.md', AuthorityLevel.CONSTITUTIONAL, sameContent),
      createTestDocument('normative.md', AuthorityLevel.NORMATIVE, sameContent),
      createTestDocument('unique.md', AuthorityLevel.ARCHITECTURAL, 'unique'),
    ];

    const matrix = compiler.compile('/repo', documents);

    expect(matrix.duplicateGroups.length).toBeGreaterThan(0);
    expect(matrix.duplicateGroups[0]?.authorities.length).toBe(2);
  });

  test('compilation is deterministic', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('doc1.md', AuthorityLevel.NORMATIVE),
      createTestDocument('doc2.md', AuthorityLevel.ARCHITECTURAL),
      createTestDocument('doc3.md', AuthorityLevel.CONSTITUTIONAL),
    ];

    const matrix1 = compiler.compile('/repo', documents);
    const matrix2 = compiler.compile('/repo', documents);
    const matrix3 = compiler.compile('/repo', documents);

    expect(matrix1.totalDocumentCount).toBe(matrix2.totalDocumentCount);
    expect(matrix2.totalDocumentCount).toBe(matrix3.totalDocumentCount);

    // Same authority levels in same order
    expect(matrix1.entries.map(e => e.authority.level)).toEqual(
      matrix2.entries.map(e => e.authority.level),
    );
    expect(matrix2.entries.map(e => e.authority.level)).toEqual(
      matrix3.entries.map(e => e.authority.level),
    );
  });

  test('returns frozen immutable matrix', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('doc.md', AuthorityLevel.NORMATIVE),
    ];

    const matrix = compiler.compile('/repo', documents);

    // Matrix itself should be frozen
    expect(Object.isFrozen(matrix)).toBe(true);

    // Entries should be frozen
    expect(Object.isFrozen(matrix.entries)).toBe(true);

    // Should not be able to mutate
    expect(() => {
      (matrix as any).totalDocumentCount = 999;
    }).toThrow();
  });

  test('handles empty document set gracefully', () => {
    const compiler = new AuthorityCompiler();
    const documents: RepositoryDocument[] = [];

    // Should handle gracefully without crashing
    // Note: this test validates that the compiler handles edge cases
    // An empty repository should produce a valid (but empty) matrix
    expect(() => {
      compiler.compile('/repo', documents);
    }).not.toThrow();
  });

  test('groups documents within authority level lexicographically', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('zebra.md', AuthorityLevel.NORMATIVE),
      createTestDocument('apple.md', AuthorityLevel.NORMATIVE),
      createTestDocument('monkey.md', AuthorityLevel.NORMATIVE),
      createTestDocument('bear.md', AuthorityLevel.NORMATIVE),
    ];

    const matrix = compiler.compile('/repo', documents);

    const entry = matrix.entries[0];
    expect(entry).toBeDefined();

    if (entry) {
      const paths = entry.documents.map(d => d.path);
      expect(paths).toEqual(['apple.md', 'bear.md', 'monkey.md', 'zebra.md']);
    }
  });

  test('identifies authority precedence order', () => {
    const compiler = new AuthorityCompiler();
    const precedence = compiler.getAuthorityPrecedence();

    expect(precedence).toContain(AuthorityLevel.CONSTITUTIONAL);
    expect(precedence).toContain(AuthorityLevel.NORMATIVE);
    expect(precedence).toContain(AuthorityLevel.ARCHITECTURAL);
    expect(precedence).toContain(AuthorityLevel.GUIDANCE);
    expect(precedence).toContain(AuthorityLevel.INFORMATIONAL);

    // CONSTITUTIONAL should come before NORMATIVE
    expect(precedence.indexOf(AuthorityLevel.CONSTITUTIONAL)).toBeLessThan(
      precedence.indexOf(AuthorityLevel.NORMATIVE),
    );

    // NORMATIVE should come before ARCHITECTURAL
    expect(precedence.indexOf(AuthorityLevel.NORMATIVE)).toBeLessThan(
      precedence.indexOf(AuthorityLevel.ARCHITECTURAL),
    );
  });

  test('validates well-formed matrices', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('doc.md', AuthorityLevel.NORMATIVE),
    ];

    const matrix = compiler.compile('/repo', documents);

    expect(compiler.isValid(matrix)).toBe(true);
  });

  test('reports compilation timing', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = Array.from({ length: 50 }, (_, i) =>
      createTestDocument(`doc${i}.md`, AuthorityLevel.NORMATIVE),
    );

    const matrix = compiler.compile('/repo', documents);

    expect(matrix.compilationDurationMs).toBeGreaterThanOrEqual(0);
    expect(matrix.compiledAt).toBeDefined();
  });

  test('generates stable checksums for identical matrices', () => {
    const compiler = new AuthorityCompiler();

    const documents: RepositoryDocument[] = [
      createTestDocument('doc1.md', AuthorityLevel.NORMATIVE),
      createTestDocument('doc2.md', AuthorityLevel.ARCHITECTURAL),
    ];

    const matrix1 = compiler.compile('/repo', documents);
    const matrix2 = compiler.compile('/repo', documents);

    // Same checksum indicates deterministic generation
    expect(matrix1.checksum).toBe(matrix2.checksum);
  });
});
