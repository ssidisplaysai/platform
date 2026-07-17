# GRT-0008 Implementation Report

## Scope

Approved additive implementation scope:
- src/runtime/policy/
- tests/runtime/policy/runtime-policy.test.ts

No approved implementation changes outside this scope were performed for closure.

## Architecture Purpose

GRT-0008 introduces deterministic runtime policy compilation and evaluation using compiler-first artifacts:
- RuntimePolicyDefinition as authored source.
- RuntimePolicyIR as executable representation.
- RuntimePolicyCompilationCertificate as deterministic compile audit output.
- RuntimePolicyFactIR as evaluator input boundary.

## Compiler-First Execution Model

RuntimePolicyDefinition
-> RuntimePolicyCompiler (9 passes)
-> RuntimePolicyIR
-> RuntimePolicyCompilationCertificate
-> RuntimePolicyResolver
-> RuntimePolicyFactCompiler (Fact -> FactIR)
-> RuntimePolicyEvaluator
-> RuntimePolicyDecision + RuntimePolicyDecisionTrace
-> Adapter projections into existing runtime pipeline

## Exact Implementation Files Created or Modified

Implementation reviewed in this closure package:
- 40 TypeScript source files under src/runtime/policy
- 1 focused test file under tests/runtime/policy

Closure-phase release-blocking corrections (already validated before governance closure):
1. Definition validation too permissive.
   - Added deterministic validation for schema version, lifecycle, conflict strategy, effect, obligation validity, duplicate rule signatures, duplicate explicit rule IDs, callback rejection.
2. Foreign RuntimePolicyIR object injection could bypass local ownership assumptions.
   - Added strict context-local object ownership validation.
3. Evaluator accepted raw fact-like objects lacking Fact IR shape.
   - Added RuntimePolicyFactIR shape validation before evaluation.
4. Resolver accepted duplicate RuntimePolicyIR candidates.
   - Added deterministic duplicate-candidate rejection.

Previously completed architecture corrections retained:
- RuntimePolicyIR authoring metadata removal.
- Compilation certificate finalization correction.
- Deterministic compiler failure result conversion.
- Explicit context isolation enforcement.
- Replay equivalence and membership safeguards.
- Canonical rule identity normalization.
- Flat evidence/diagnostic APIs.
- Closed Fact IR type contract.
- Canonical Fact IR provenance.
- Context-bound snapshot store.

## Identity and Determinism Rules

- All artifact identities derive from canonical serialized content digests.
- Pass ordering and emitted pass results are deterministic.
- Failure artifacts are deterministic and immutable.
- Replay integrity requires locally registered and digest-matching policy artifacts.

## Supported Fact Types

Closed vocabulary:
- String
- Number
- Boolean
- Null
- Json

## Decision Outcomes

- Permit
- Deny
- Conditional
- NotApplicable
- Indeterminate

## Conflict Strategies

- deny-overrides (default)
- permit-overrides
- first-applicable
- only-one-applicable

## Obligation Model

- Obligations are inert descriptors.
- Obligations are emitted with immutable decision outputs.
- Obligations do not execute policy side effects directly.

## Context Isolation and Snapshot Model

- Policy registration/evaluation/replay are RuntimeExecutionContext-owned.
- Cross-context access and replay are rejected.
- Snapshot store save/load/history enforce context ownership.

## Replay Model

- Replay verifies equivalence of decision/trace/facts/policy digests.
- Replay rejects injected or foreign context policy artifacts.
