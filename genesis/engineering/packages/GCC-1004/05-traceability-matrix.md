# GCC-1004 Traceability Matrix

| Requirement | Implementation | Validation |
|---|---|---|
| Deterministic Evidence IR to Knowledge IR transformation | `src/compiler/knowledge/KnowledgeCompiler.ts` | `tests/compiler/knowledge/knowledge-canonical-compiler.test.ts`, `tests/compiler/knowledge/deterministic-knowledge-compilation.test.ts` |
| Canonical knowledge model, hashing, validation | `src/compiler/knowledge/KnowledgeIR.ts`, `KnowledgeGraphHasher.ts`, `KnowledgeValidator.ts` | `tests/compiler/knowledge/knowledge-compiler.test.ts`, `tests/compiler/knowledge/knowledge-validator.test.ts` |
| Governed kernel integration | `src/compiler/core/passes/KnowledgeCompilerPass.ts`, `src/compiler/core/CompilerCore.ts` | `tests/compiler/core/compiler-core-integration.test.ts`, `tests/compiler/core/compiler-kernel.test.ts` |
| GCC-1003 preservation | `src/evidence-ir/compiler/index.ts`, `src/compiler/stages/EvidenceCompiler.ts` | `tests/compiler/evidence-ir-compiler.test.ts`, `tests/deterministic-eko.test.ts` |
