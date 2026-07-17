# GRT-0008 Architecture Delta

## Delta Summary

GRT-0008 adds a compiler-first Runtime Policy subsystem to Genesis runtime, with no redesign of frozen runtime foundations.

New additive subsystem:
- src/runtime/policy

No behavioral/public-contract changes to:
- GRT-0001 Runtime Kernel
- GRT-0002 Enterprise Host
- GRT-0003 Runtime Services
- GRT-0004 Runtime Object System
- GRT-0005 Runtime Messaging
- GRT-0006 Runtime Scheduler
- GRT-0007 Runtime Workflow Engine

## Architectural Placement

Policy engine inserts between authored policy input and runtime adapter projection:
- compile authored definitions to executable IR and certificate
- resolve/evaluate with compiled fact artifacts
- project immutable decision artifacts to existing runtime pipeline through additive adapters

## Boundary Clarifications

- RuntimePolicyDefinition: authored artifact only, never directly executed.
- RuntimePolicyIR: only executable policy representation.
- RuntimePolicyFact: authored input fact.
- RuntimePolicyFactIR: only evaluator fact representation.
- RuntimePolicyEvaluator: synchronous, pure evaluation only.
- RuntimePolicyResolver: candidate resolution only, no rule evaluation.
- RuntimePolicyManager: context ownership and replay membership authority for policy scope.

## Security/Ownership Boundary with GRT-0009

GRT-0008 does not assume ownership of:
- identities
- principals
- claims
- authentication
- trust
- credentials
- authorization context
- tenant security

These remain governed by GRT-0009.

## Deterministic Runtime Guarantees

- Canonical serialization-based digests for identities.
- Deterministic pass order and pass-result records.
- Deterministic failure artifacts for compile invalid path.
- Deterministic resolver ordering and replay verification.
