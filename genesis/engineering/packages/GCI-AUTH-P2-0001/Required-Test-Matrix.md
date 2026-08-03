# Required Test Matrix

## Test Matrix Scope
This matrix defines minimum required tests for IBR Runtime implementation and certification.

## Required Test Categories
1. Determinism Tests
- identical input, identical output assertions
- ordering stability assertions

2. Identity Tests
- deterministic identity derivation
- collision handling behavior

3. Immutability Tests
- source replay artifacts remain unchanged
- append-only version behavior

4. Linkage Tests
- replay linkage presence and correctness
- manifest linkage propagation
- evidence linkage propagation
- certification linkage references

5. Boundary Enforcement Tests
- entity creation attempts rejected
- relationship creation attempts rejected
- business rule evaluation attempts rejected
- genome assembly attempts rejected

6. Failure Behavior Tests
- fail-closed behavior for malformed inputs
- deterministic error artifact generation

7. Registry Behavior Tests
- deterministic registration keys
- duplicate key handling policy conformance
- version lineage continuity checks