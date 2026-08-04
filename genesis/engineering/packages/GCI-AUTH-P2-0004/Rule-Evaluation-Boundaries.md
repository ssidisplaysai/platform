# Rule Evaluation Boundaries

## Evaluation Inputs
- immutable Entity Runtime outputs
- immutable Relationship Runtime outputs
- governed rule definitions
- explicit dependency metadata
- preserved provenance and replay records

## Evaluation Constraints
- deterministic only
- no mutation of inputs
- no implicit external state
- no asynchronous coordination requirement
- no nondeterministic ordering
- no hidden policy source
- no side effects
- unresolved rule outcomes must remain unresolved
- contradictory evidence must be preserved
- Business Rule Runtime must not silently resolve contradictions
- replay of identical inputs must produce identical unresolved outcomes

## Evaluation Output Rules
- outputs must be immutable
- outputs must be reproducible from the same inputs
- outputs must carry lineage, provenance, replay linkage, evidence linkage, and certification linkage
- outputs must be suitable for append-only lifecycle tracking
- rule supersedence must be append-only
- retired rules must remain historically reproducible

## Conflict Handling
Only explicit, documented deterministic rule precedence may resolve conflicts. Resolution authority belongs only to downstream Business Genome Assembly Runtime or another explicitly authorized downstream runtime. Any other conflict resolution method is out of scope.