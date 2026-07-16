# GCC-1004 Repository Impact

## Runtime Surface Changed
- Added the canonical knowledge compiler implementation.
- Added a governed knowledge compiler pass to the core pipeline.
- Expanded knowledge exports so the compiler can be consumed through the package surface.

## Test Surface Changed
- Added a focused GCC-1004 knowledge compiler regression suite.
- Extended the compiler core integration test to assert the `knowledgeIR` output.

## Out of Scope
- Foundation artifacts were not modified.
- Discovery and evidence compiler semantics were preserved.
- Existing knowledge-graph compatibility behavior remains available through the wrapped graph output.