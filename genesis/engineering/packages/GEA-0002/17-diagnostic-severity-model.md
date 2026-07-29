# 17 Diagnostic Severity Model

## Severity Classes
1. FATAL: compiler cannot produce a valid Atlas.
2. ERROR: Atlas output would violate constitutional, governance, ownership, boundary, or traceability requirements.
3. WARNING: Atlas can be emitted with incomplete, inferred, stale, or ambiguous evidence.
4. INFORMATIONAL: non-blocking observation.

## Blocking Matrix
1. FATAL blocks generation, certification, freeze, application consumption, and query publication.
2. ERROR blocks certification and freeze; may also block generation for constitutional/ownership/authority errors.
3. WARNING does not block generation but blocks freeze unless policy explicitly permits.
4. INFORMATIONAL does not block.

## Concept Separation
1. Severity indicates execution and publication risk.
2. Validation status indicates rule outcome (PASS, PARTIAL, FAIL, NOT APPLICABLE).
3. Authority classification indicates evidence class (AUTHORITATIVE, DERIVED, POTENTIAL, UNKNOWN).
4. Certification status indicates certification lifecycle standing.

## Stage Blocking Semantics

Severity order:
1. FATAL
2. ERROR
3. WARNING
4. INFORMATIONAL

Stage DISCOVERY:
1. FATAL: fail closed; emit diagnostic-only output if explicitly enabled.
2. ERROR: continue with degraded scope where possible; unresolved critical discovery claims blocked.
3. WARNING: continue with degraded output classification.
4. INFORMATIONAL: continue.

Stage PARSING:
1. FATAL: fail closed; blocks authoritative extraction.
2. ERROR: continue with degraded extraction; affected claims blocked.
3. WARNING: continue, mark partial.
4. INFORMATIONAL: continue.

Stage EXTRACTION:
1. FATAL: blocks Atlas generation.
2. ERROR: may allow diagnostic Atlas emission; blocks successful extraction completion.
3. WARNING: continue with explicit degraded states.
4. INFORMATIONAL: continue.

Stage GRAPH_CONSTRUCTION:
1. FATAL: blocks graph finalization.
2. ERROR: blocks successful graph validation and authoritative publication for affected scope.
3. WARNING: continue with classified partial graph areas.
4. INFORMATIONAL: continue.

Stage ATLAS_GENERATION:
1. FATAL: blocks Atlas generation unless diagnostic-only mode is explicitly permitted.
2. ERROR: may allow diagnostic Atlas emission; blocks successful generation state.
3. WARNING: generation allowed with degraded or incomplete state.
4. INFORMATIONAL: generation allowed.

Stage ATLAS_VALIDATION:
1. FATAL: blocks validation completion.
2. ERROR: blocks successful validation.
3. WARNING: validation may complete as PARTIAL, cannot be silently ignored.
4. INFORMATIONAL: no block.

Stage ATLAS_CERTIFICATION:
1. FATAL: blocks certification.
2. ERROR: blocks certification.
3. WARNING: may block certification if warning class is certification-critical by policy.
4. INFORMATIONAL: no block.

Stage ATLAS_FREEZE:
1. FATAL: blocks freeze.
2. ERROR: blocks freeze.
3. WARNING: may block freeze where policy classifies warning as freeze-critical.
4. INFORMATIONAL: no block.

Stage APPLICATION_CONSUMPTION:
1. FATAL: blocks consumption.
2. ERROR: blocks authoritative consumption for affected scope.
3. WARNING: allows constrained consumption only when policy permits degraded state.
4. INFORMATIONAL: no block.

Stage QUERY_PUBLICATION:
1. FATAL: blocks publication.
2. ERROR: blocks publication of affected query families.
3. WARNING: allows publication with explicit PARTIAL/UNKNOWN/BLOCKED state signaling.
4. INFORMATIONAL: no block.

## Affected-Scope Behavior
1. Localized query defects block affected query families, not unrelated families, unless constitutional integrity failure triggers global fail-closed behavior.
2. Constitutional integrity failures are global blockers.
