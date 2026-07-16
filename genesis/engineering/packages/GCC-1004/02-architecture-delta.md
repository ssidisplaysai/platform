# GCC-1004 Architecture Delta

GCC-1004 extends the compiler platform with a governed canonical knowledge stage.

Key delta:
- `KnowledgeCompiler` now transforms validated Evidence IR into canonical Knowledge IR.
- `CompilerCore` now surfaces `knowledgeIR` from the governed pass pipeline.
- `KnowledgeCompilerPass` integrates the knowledge stage through the kernel registry.
- `KnowledgeIR`, `KnowledgeIdentity`, `KnowledgeGraphHasher`, and `KnowledgeValidator` now support canonical objects, conflict artifacts, lineage, provenance, temporal validity, and immutable output.

Preserved architecture:
- Foundation boundaries remain unchanged.
- GCC-1001 compiler architecture remains intact.
- GCC-1002 governed kernel semantics remain intact.
- GCC-1003 evidence compiler behavior remains intact.

This milestone adds a new canonical knowledge layer without replacing the existing discovery or evidence stages.
