# Genesis Commerce Integration Boundary Model

## Allowed Commerce Publications
Commerce may publish:
1. Events
2. Commands
3. Queries
4. Read models

## Prohibited Cross-Application Behavior
Applications shall not:
1. Read Commerce databases directly.
2. Mutate Commerce aggregates directly.
3. Depend on Commerce internal persistence structure.
4. Assume non-contract implementation details.

## Authority Separation
1. Commerce
- Owns commercial lifecycle authority.
- Publishes contract envelopes.
- Maintains version and replay compatibility.

2. Downstream Applications
- Consume events and read models.
- Issue commands through contract interfaces.
- Preserve correlation and idempotency semantics.

## Boundary Enforcement Rules
1. Contract validation is mandatory at ingress and egress boundaries.
2. Unknown future fields must be tolerated by consumers.
3. Breaking contract changes require new major versions.
4. Producer and consumer responsibilities are independently auditable.

## Boundary Certification Statement
Integration boundaries remain implementation-independent and contract-governed.
