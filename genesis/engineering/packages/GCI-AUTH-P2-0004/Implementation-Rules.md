# Implementation Rules

## Implementation Mandate
The later GCI-P2-0004 implementation must remain deterministic, pure, and scope-limited to Business Rule Runtime responsibilities only.

## Required Implementation Properties
- immutable inputs
- immutable outputs
- deterministic evaluation order
- explicit rule versioning
- append-only rule supersedence
- historically reproducible retired rules
- append-only lifecycle behavior
- preserved provenance and replay linkage
- deterministic registry behavior

## Implementation Prohibitions
- no business genome assembly
- no persistence ownership
- no scheduling or queue processing
- no worker orchestration
- no deployment logic
- no infrastructure control
- no database ownership
- no message bus control
- no workflow engine behavior
- no AI, LLM, machine learning, heuristics, probabilistic reasoning, inference, OCR, or crawlers
- no runtime mutation
- no side effects
- no silent contradiction resolution

## Unresolved Outcome Rule
The later implementation must preserve unresolved rule outcomes as unresolved and must preserve contradictory evidence. Any contradiction resolution authority belongs only to downstream Business Genome Assembly Runtime or another explicitly authorized downstream runtime.