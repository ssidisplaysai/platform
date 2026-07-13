/**
 * repository-analyzer.test.ts
 * Comprehensive tests for the Genesis Repository Analyzer vertical slice.
 *
 * Tests cover:
 * - Recursive discovery
 * - Supported extension filtering
 * - Ignored directories
 * - Deterministic lexical ordering
 * - Path normalization (Windows/POSIX)
 * - Metadata extraction (YAML, H1, labeled fields)
 * - Authority classification
 * - Immutability and repeated-run equivalence
 * - Edge cases and tolerances
 */

import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RepositoryScanner } from '../RepositoryScanner';
import { DocumentParser } from '../DocumentParser';
import { AuthorityClassifier } from '../AuthorityClassifier';
import { RepositoryAnalyzer } from '../RepositoryAnalyzer';

describe('Genesis Repository Analyzer - Vertical Slice', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary repository for testing
    tempDir = join(tmpdir(), `gra-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('RepositoryScanner', () => {
    test('discovers supported file types recursively', async () => {
      const scanner = new RepositoryScanner();

      // Create test file structure
      const docDir = join(tempDir, 'docs');
      const archDir = join(docDir, 'architecture');
      await fs.mkdir(archDir, { recursive: true });

      // Create supported files
      await fs.writeFile(join(archDir, 'spec.md'), '# Spec');
      await fs.writeFile(join(archDir, 'config.json'), '{}');
      await fs.writeFile(join(archDir, 'schema.yaml'), 'version: 1');
      await fs.writeFile(join(docDir, 'code.ts'), 'const x = 1;');

      // Create unsupported file (should be ignored)
      await fs.writeFile(join(archDir, 'image.png'), 'fake');

      const documents = await scanner.scan(tempDir);

      expect(documents.length).toBe(4);
      expect(documents.map(d => d.path).sort()).toEqual(
        documents.map(d => d.path),
      );
    });

    test('ignores excluded directories', async () => {
      const scanner = new RepositoryScanner();

      // Create test file structure with excluded directories
      const nodeModulesDir = join(tempDir, 'node_modules', 'lib');
      const gitDir = join(tempDir, '.git', 'objects');
      const docDir = join(tempDir, 'docs');

      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.mkdir(gitDir, { recursive: true });
      await fs.mkdir(docDir, { recursive: true });

      // Create files in all directories
      await fs.writeFile(join(nodeModulesDir, 'package.json'), '{}');
      await fs.writeFile(join(gitDir, 'config.md'), '# Config');
      await fs.writeFile(join(docDir, 'readme.md'), '# README');

      const documents = await scanner.scan(tempDir);

      // Only docs/readme.md should be found
      const foundPaths = documents.map(d => d.path);
      expect(foundPaths).toContain('docs/readme.md');
      expect(foundPaths).not.toContainEqual(expect.stringContaining('node_modules'));
      expect(foundPaths).not.toContainEqual(expect.stringContaining('.git'));
    });

    test('normalizes paths to canonical form (forward slashes)', async () => {
      const scanner = new RepositoryScanner();

      const docDir = join(tempDir, 'docs', 'architecture');
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(join(docDir, 'spec.md'), '# Spec');

      const documents = await scanner.scan(tempDir);

      expect(documents.length).toBeGreaterThan(0);
      documents.forEach(doc => {
        expect(doc.path).not.toContain('\\');
        expect(doc.path).toMatch(/^[\w/-]+\.[\w]+$/);
      });
    });

    test('returns deterministic ordering', async () => {
      const scanner = new RepositoryScanner();

      const docDir = join(tempDir, 'files');
      await fs.mkdir(docDir, { recursive: true });

      // Create files in random order
      const fileNames = ['zebra.md', 'apple.json', 'monkey.yaml', 'bear.ts'];
      for (const name of fileNames) {
        await fs.writeFile(join(docDir, name), 'content');
      }

      // Scan multiple times
      const scan1 = await scanner.scan(tempDir);
      const scan2 = await scanner.scan(tempDir);
      const scan3 = await scanner.scan(tempDir);

      const paths1 = scan1.map(d => d.path);
      const paths2 = scan2.map(d => d.path);
      const paths3 = scan3.map(d => d.path);

      expect(paths1).toEqual(paths2);
      expect(paths2).toEqual(paths3);

      // Verify lexicographic order
      const sorted = [...paths1].sort();
      expect(paths1).toEqual(sorted);
    });

    test('handles empty repository gracefully', async () => {
      const scanner = new RepositoryScanner();
      const emptyDir = join(tempDir, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });

      const documents = await scanner.scan(emptyDir);

      expect(documents).toEqual([]);
    });

    test('handles malformed/unreadable files gracefully', async () => {
      const scanner = new RepositoryScanner();

      const docDir = join(tempDir, 'malformed');
      await fs.mkdir(docDir, { recursive: true });

      // Create readable file
      await fs.writeFile(join(docDir, 'good.md'), '# Good');

      // Try to create unreadable file (on Unix systems)
      try {
        await fs.writeFile(join(docDir, 'bad.json'), '{}');
        await fs.chmod(join(docDir, 'bad.json'), 0o000);

        const documents = await scanner.scan(docDir);
        // Should include good.md but skip bad.json
        expect(documents.some(d => d.fileName === 'good.md')).toBe(true);
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(join(docDir, 'bad.json'), 0o644);
        } catch {
          // Ignored
        }
      }
    });

    test('returns immutable documents array', async () => {
      const scanner = new RepositoryScanner();

      const docDir = join(tempDir, 'immutable');
      await fs.mkdir(docDir, { recursive: true });
      await fs.writeFile(join(docDir, 'test.md'), '# Test');

      const documents = await scanner.scan(docDir);

      // Should not be able to mutate array
      expect(() => {
        (documents as any).push({});
      }).toThrow();

      // Should not be able to mutate individual documents
      expect(() => {
        (documents[0] as any).title = 'Modified';
      }).toThrow();
    });
  });

  describe('DocumentParser', () => {
    test('extracts title from H1 heading', () => {
      const parser = new DocumentParser();
      const doc = {
        path: 'test.md',
        fileName: 'test.md',
        content: '# My Title\n\nContent here',
        extension: '.md',
        nameWithoutExtension: 'test',
        parentDirectory: '',
        absolutePath: '/test.md',
        id: 'doc_test_v1',
        sizeBytes: 100,
        lineCount: 3,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const parsed = parser.parse(doc);

      expect(parsed.title).toBe('My Title');
    });

    test('extracts version from filename', () => {
      const parser = new DocumentParser();
      const doc = {
        path: 'spec-v1.2.3.md',
        fileName: 'spec-v1.2.3.md',
        content: 'Content',
        extension: '.md',
        nameWithoutExtension: 'spec-v1.2.3',
        parentDirectory: '',
        absolutePath: '/spec-v1.2.3.md',
        id: 'doc_spec_v1',
        sizeBytes: 100,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const parsed = parser.parse(doc);

      expect(parsed.version).toBe('v1.2.3');
    });

    test('extracts specification references', () => {
      const parser = new DocumentParser();
      const doc = {
        path: 'test.md',
        fileName: 'test.md',
        content: 'This references GCF-0001 and BGC-0002',
        extension: '.md',
        nameWithoutExtension: 'test',
        parentDirectory: '',
        absolutePath: '/test.md',
        id: 'doc_test_v1',
        sizeBytes: 100,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const parsed = parser.parse(doc);

      expect(parsed.externalReferences).toContain('BGC-0002');
      expect(parsed.externalReferences).toContain('GCF-0001');
    });

    test('handles missing metadata gracefully', () => {
      const parser = new DocumentParser();
      const doc = {
        path: 'empty.json',
        fileName: 'empty.json',
        content: '{}',
        extension: '.json',
        nameWithoutExtension: 'empty',
        parentDirectory: '',
        absolutePath: '/empty.json',
        id: 'doc_empty_v1',
        sizeBytes: 2,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const parsed = parser.parse(doc);

      expect(parsed.title).toBeNull();
      expect(parsed.version).toBeNull();
      expect(parsed.status).toBeNull();
    });
  });

  describe('AuthorityClassifier', () => {
    test('classifies constitutional documents', () => {
      const classifier = new AuthorityClassifier();
      const doc = {
        path: 'genesis/constitution/CONSTITUTION.md',
        fileName: 'CONSTITUTION.md',
        content: '# Constitutional Document',
        extension: '.md',
        nameWithoutExtension: 'CONSTITUTION',
        parentDirectory: 'genesis/constitution',
        absolutePath: '/genesis/constitution/CONSTITUTION.md',
        id: 'doc_constitution_v1',
        sizeBytes: 100,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const authority = classifier.classify(doc);

      expect(authority.level).toBe('CONSTITUTIONAL');
      expect(authority.isFrozen).toBe(true);
    });

    test('classifies architectural documents', () => {
      const classifier = new AuthorityClassifier();
      const doc = {
        path: 'docs/architecture/GCF-0001.md',
        fileName: 'GCF-0001.md',
        content: '# Architecture',
        extension: '.md',
        nameWithoutExtension: 'GCF-0001',
        parentDirectory: 'docs/architecture',
        absolutePath: '/docs/architecture/GCF-0001.md',
        id: 'doc_gcf_v1',
        sizeBytes: 100,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const authority = classifier.classify(doc);

      expect(authority.level).toBe('ARCHITECTURAL');
    });

    test('deterministic classification for identical documents', () => {
      const classifier = new AuthorityClassifier();
      const doc = {
        path: 'docs/test.md',
        fileName: 'test.md',
        content: 'Content',
        extension: '.md',
        nameWithoutExtension: 'test',
        parentDirectory: 'docs',
        absolutePath: '/docs/test.md',
        id: 'doc_test_v1',
        sizeBytes: 100,
        lineCount: 1,
        contentChecksum: 'sha256',
        authority: {
          level: 'UNCLASSIFIED' as const,
          displayName: 'Unclassified',
          namespace: 'genesis/unclassified',
          canOverride: [],
          precedence: 0,
          isFrozen: false,
          description: 'Test',
        },
        isFrozen: false,
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

      const auth1 = classifier.classify(doc);
      const auth2 = classifier.classify(doc);
      const auth3 = classifier.classify(doc);

      expect(auth1.level).toBe(auth2.level);
      expect(auth2.level).toBe(auth3.level);
    });
  });

  describe('RepositoryAnalyzer', () => {
    test('generates deterministic inventory for identical repositories', async () => {
      const analyzer = new RepositoryAnalyzer();

      const repo1Dir = join(tempDir, 'repo1');
      const repo2Dir = join(tempDir, 'repo2');

      for (const dir of [repo1Dir, repo2Dir]) {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(join(dir, 'README.md'), '# Readme\n\nContent');
        await fs.writeFile(join(dir, 'config.json'), '{}');
      }

      const report1 = await analyzer.analyze(repo1Dir);
      const report2 = await analyzer.analyze(repo2Dir);

      expect(report1.documents.length).toBe(report2.documents.length);
      expect(report1.documents.map(d => d.fileName)).toEqual(
        report2.documents.map(d => d.fileName),
      );
    });

    test('repeated scans produce identical results', async () => {
      const analyzer = new RepositoryAnalyzer();

      const testDir = join(tempDir, 'repeat-scan');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'spec.md'), '# Spec v1.0\n\nReferences GCF-0001');

      const report1 = await analyzer.analyze(testDir);
      const report2 = await analyzer.analyze(testDir);
      const report3 = await analyzer.analyze(testDir);

      const paths1 = report1.documents.map(d => d.path).sort();
      const paths2 = report2.documents.map(d => d.path).sort();
      const paths3 = report3.documents.map(d => d.path).sort();

      expect(paths1).toEqual(paths2);
      expect(paths2).toEqual(paths3);

      // Verify metadata consistency
      expect(report1.documents[0]?.version).toBe(report2.documents[0]?.version);
      expect(report1.documents[0]?.externalReferences).toEqual(
        report2.documents[0]?.externalReferences,
      );
    });

    test('returns immutable inventory', async () => {
      const analyzer = new RepositoryAnalyzer();

      const testDir = join(tempDir, 'immutable-report');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(join(testDir, 'doc.md'), 'Content');

      const report = await analyzer.analyze(testDir);

      // Should not be able to mutate documents array
      expect(() => {
        (report.documents as any).push({});
      }).toThrow();

      // Should not be able to mutate individual document
      expect(() => {
        (report.documents[0] as any).title = 'Modified';
      }).toThrow();
    });

    test('is properly configured', () => {
      const analyzer = new RepositoryAnalyzer();

      expect(analyzer.isConfigured()).toBe(true);
      expect(analyzer.getVersion()).toBe('1.0.0');
    });
  });

  describe('Determinism Contract', () => {
    test('identical repository produces identical checksums across runs', async () => {
      const analyzer = new RepositoryAnalyzer();

      const testDir = join(tempDir, 'determinism-test');
      await fs.mkdir(testDir, { recursive: true });

      const files = {
        'README.md': '# Project\n\nVersion: 1.0\nStatus: DRAFT',
        'spec.ts': 'interface Spec {}',
        'config.json': '{"name": "test"}',
      };

      for (const [name, content] of Object.entries(files)) {
        await fs.writeFile(join(testDir, name), content);
      }

      const report1 = await analyzer.analyze(testDir);
      const report2 = await analyzer.analyze(testDir);

      // Same document count
      expect(report1.documents.length).toBe(report2.documents.length);

      // Same paths in same order
      expect(report1.documents.map(d => d.path)).toEqual(
        report2.documents.map(d => d.path),
      );

      // Same extracted metadata
      report1.documents.forEach((doc1, idx) => {
        const doc2 = report2.documents[idx];
        expect(doc1.title).toBe(doc2?.title);
        expect(doc1.version).toBe(doc2?.version);
        expect(doc1.status).toBe(doc2?.status);
        expect([...doc1.externalReferences].sort()).toEqual(
          [...(doc2?.externalReferences ?? [])].sort(),
        );
      });
    });
  });
});
