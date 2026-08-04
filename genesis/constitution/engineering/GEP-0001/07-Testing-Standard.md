# 07 Testing Standard

Required test categories:

- Unit tests
- Boundary tests
- Recovery tests
- Restart tests
- Negative tests
- Mission Control tests

Testing principles:

- Behavior must be deterministic under equivalent inputs.
- Boundary tests must prove no ownership leakage.
- Recovery tests must prove fail-closed integrity posture.
- Restart tests must prove durable-state continuity.
- Negative tests must validate error-path governance behavior.
- Mission Control tests must validate observational-only integration posture.

Regression expectations:

- Package changes shall maintain or strengthen regression confidence.
- Regression suites shall include critical lifecycle and boundary pathways.
- Test evidence must be certification-ready.
