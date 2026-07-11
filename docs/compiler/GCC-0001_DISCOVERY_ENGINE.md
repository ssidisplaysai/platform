# GCC-0001 Discovery Engine

## Purpose

GCC-0001 implements the first compiler-facing Genesis Discovery Engine for deterministic knowledge ingestion into Evidence IR.

The engine ingests supported sources, normalizes content and metadata, captures provenance, and emits deterministic Evidence IR for compiler consumption.

## Architecture

Pipeline:

1. DiscoveryEngine receives a KnowledgeSource.
2. DiscoveryRegistry resolves a DiscoveryPlugin by sourceType.
3. Plugin ingests artifacts into raw discovery records.
4. CanonicalNormalizer normalizes content and metadata deterministically.
5. ProvenanceEngine computes checksums, ids, and version identifiers.
6. EvidenceEmitter compiles artifacts into Evidence IR graph output.

Core namespace:

1. src/compiler/discovery
2. src/compiler/plugins
3. src/compiler/provenance
4. src/compiler/normalization
5. src/compiler/evidence

## Plugin Contract

A discovery plugin must:

1. Declare name and sourceType.
2. Implement discover(job) and return RawKnowledgeArtifact[] through the shared interface.
3. Provide source identifiers, origin, timestamps, metadata, lineage, and content.
4. Preserve deterministic ordering when returning multiple artifacts.

Supported in GCC-0001:

1. markdown
2. json
3. yaml
4. filesystem

Not implemented in GCC-0001:

1. pdf
2. docx
3. ocr
4. email
5. database

## Provenance Rules

Every emitted artifact includes:

1. id
2. sourceId
3. artifactId
4. versionId
5. sourceType
6. origin
7. checksum
8. createdAt
9. modifiedAt
10. discoveredAt
11. metadata
12. lineage
13. confidence

Provenance behavior:

1. checksum is SHA-256 of normalized content.
2. artifactId is derived from source identity and origin.
3. versionId is derived from checksum.
4. id is derived from artifactId + versionId fingerprint.
5. lineage captures source and plugin ancestry.

## Deterministic Output Rules

1. Filesystem traversal is lexicographically sorted.
2. Artifact ordering is stable by sourceId, artifactId, and versionId.
3. Metadata keys are recursively sorted.
4. JSON and YAML normalize to stable canonical JSON strings.
5. Evidence nodes and relationships are sorted deterministically.
6. Deterministic hash is computed from canonical IR shape.

## Evidence IR Boundary

Discovery output compiles into Evidence IR only.

Evidence IR contains:

1. schemaVersion
2. graph nodes and relationships
3. artifactCount
4. generatedAt
5. deterministicHash

Discovery does not perform business semantic compilation.

## Known Limitations

1. YAML parser supports deterministic core YAML subset and not full YAML specification.
2. Filesystem plugin currently ingests only markdown/json/yaml extensions.
3. CI integration for discovery tests depends on repository pipeline activation.

## GCC-0001-H1 Hardening Validation

Hardening validation includes:

1. Large filesystem fixture ingestion with benchmark-style stability check.
2. Deterministic Evidence IR verification under larger input sets.
3. Negative input checks for malformed JSON and YAML.
4. Typed error checks for missing paths and unsupported source types.
5. Empty file ingestion behavior validation.

Typed discovery error codes:

1. PLUGIN_NOT_REGISTERED
2. UNSUPPORTED_EXTENSION
3. MISSING_SOURCE
4. PARSE_ERROR

Determinism proof rule:

Repeated ingestion of unchanged input must produce identical artifacts and identical Evidence IR output.

## CI Integration Snippet

Recommended discovery hardening test command:

```bash
npx tsc --module commonjs --target es2020 --outDir .tmp-gcc-tests --rootDir . --esModuleInterop true --skipLibCheck true --resolveJsonModule true --strict true $(find src/compiler -name "*.ts") $(find tests/compiler/discovery -name "*.ts")
node --test .tmp-gcc-tests/tests/compiler/discovery/*.test.js
```

Windows PowerShell variant:

```powershell
$srcFiles = Get-ChildItem src/compiler -Recurse -Filter *.ts | ForEach-Object { $_.FullName }
$testFiles = Get-ChildItem tests/compiler/discovery -Filter *.ts | ForEach-Object { $_.FullName }
npx tsc --module commonjs --target es2020 --outDir .tmp-gcc-tests --rootDir . --esModuleInterop true --skipLibCheck true --resolveJsonModule true --strict true $srcFiles $testFiles
node --test .tmp-gcc-tests/tests/compiler/discovery/*.test.js
```

Recommended CI workflow step (aligned to governance quality gates):

```yaml
- name: Discovery Compiler Hardening Tests
	shell: bash
	run: |
		SRC_FILES=$(find src/compiler -name "*.ts")
		TEST_FILES=$(find tests/compiler/discovery -name "*.ts")
		npx tsc --module commonjs --target es2020 --outDir .tmp-gcc-tests --rootDir . --esModuleInterop true --skipLibCheck true --resolveJsonModule true --strict true $SRC_FILES $TEST_FILES
		node --test .tmp-gcc-tests/tests/compiler/discovery/*.test.js
```

Cleanup recommendation:

```bash
rm -rf .tmp-gcc-tests
```

## Next Sprint Recommendations

1. Add full-schema YAML support with approved dependency strategy or internal parser expansion.
2. Add PDF and DOCX plugin stubs with explicit non-goal behavior.
3. Add discovery plugin capability negotiation and plugin health diagnostics.
4. Extend Evidence IR relationships beyond source -> artifact for richer lineage graphing.
5. Add performance benchmarks for large filesystem ingestion workloads.
