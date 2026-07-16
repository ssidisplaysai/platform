# GCC-1004 Traceability

## Requirements to Code Trace
- Deterministic Evidence IR to Knowledge IR transformation: `src/compiler/knowledge/KnowledgeCompiler.ts`
- Canonical identity and hash behavior: `src/compiler/knowledge/KnowledgeIdentity.ts`, `src/compiler/knowledge/KnowledgeGraphHasher.ts`
- Knowledge structural validation: `src/compiler/knowledge/KnowledgeValidator.ts`
- Governed compiler-core integration: `src/compiler/core/passes/KnowledgeCompilerPass.ts`, `src/compiler/core/CompilerCore.ts`

## Requirements to Tests Trace
- Input-order determinism: `tests/compiler/knowledge/knowledge-canonical-compiler.test.ts`
- Duplicate consolidation and conflict preservation: `tests/compiler/knowledge/knowledge-canonical-compiler.test.ts`
- Immutable output snapshot: `tests/compiler/knowledge/knowledge-canonical-compiler.test.ts`
- Repeated compilation determinism: `tests/compiler/knowledge/deterministic-knowledge-compilation.test.ts`
- Core pipeline exposure of `knowledgeIR`: `tests/compiler/core/compiler-core-integration.test.ts`

## Validation Evidence
- Focused knowledge compiler test slice: PASS
- ESLint on touched scope: PASS
- Compiler core integration test: PASS
- Node suite: PASS
- Aggregate suite: PASS