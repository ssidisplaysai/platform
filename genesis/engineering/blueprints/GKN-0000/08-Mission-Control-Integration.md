# 08 Mission Control Integration

Mission Control integration scope:

- Health visibility
- Metrics visibility
- Audit visibility
- Runtime status visibility

Mission Control constraints:

- Observability only
- No ownership of knowledge business behavior
- No mutation authority over domain state

Planned observability surfaces:

- Health endpoint contract
- Metrics endpoint contract
- Audit summary contract
- Capability metadata/status contract

Integration philosophy:

- Mission Control consumes observability surfaces emitted by Knowledge runtime.
- Knowledge remains authoritative owner of knowledge-domain behavior.
