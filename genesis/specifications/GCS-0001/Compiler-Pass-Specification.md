# Compiler Pass Specification

## 1. Normative Pass Model
- A compiler pass MUST declare identifier, purpose, required inputs, produced outputs, and failure conditions.
- Pass execution order MUST be deterministic and version-governed.
- Passes MUST operate on immutable input references.

## 2. Normative Pass Requirements
- A pass MUST validate required preconditions before execution.
- A pass MUST produce explicit postconditions and diagnostics.
- A pass MUST record provenance references for all outputs.
- A pass MUST record version references for rule sets, compiler, and specification.

## 3. Normative Pass Dependency Rules
- Pass dependencies MUST be explicit.
- Circular pass dependency SHALL NOT be permitted unless explicitly defined by a future specification revision.
- Dependency resolution MUST be deterministic.

## 4. Normative Pass Failure Handling
- Failures MUST preserve immutable error artifacts.
- Failure artifacts MUST include sufficient data for replay and certification review.

## Informative Guidance
Pass implementation internals are out of scope; only observable normative behavior is constrained.
