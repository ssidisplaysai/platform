# GCC-1004 API Documentation

## KnowledgeCompiler

`KnowledgeCompiler` compiles validated `EvidenceIR` into canonical `KnowledgeIR`.

Primary members:
- `compile(evidenceIR, context?)`
- `compileWithResult(evidenceIR, context?)`

Behavior:
- deterministic identity generation
- canonical clustering and duplicate consolidation
- conflict preservation
- provenance and lineage retention
- immutable output snapshot

## KnowledgeCompilerPass

`KnowledgeCompilerPass` integrates canonical knowledge compilation into the governed compiler core.

It accepts the output of the evidence pass and emits `knowledgeIR` as the pass payload.

## CompilerCore Output

`CompilerCore` now returns:
- `artifacts`
- `evidenceIR`
- `knowledgeIR` when the canonical knowledge pass completes successfully
- `manifest`

## Validation Contract

The knowledge validator checks:
- deterministic ordering
- confidence ranges
- lineage structure
- provenance presence
- identity validity
- claim counts
- hash integrity
