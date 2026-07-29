# Genesis Service Interaction Architecture

## Interaction Model
Services communicate through:
- Published contracts
- Messages
- Events
- Registered interfaces

Forbidden:
- Direct database coupling
- Hidden cross-service persistence contracts
- Undocumented private interfaces

## Interaction Contract Requirements
Each service-to-service or application-to-service interaction must include:
- Producer and consumer identifiers
- Contract version
- Authorization requirement
- Observability hooks
- Failure behavior and retry policy

## Canonical Interaction Patterns
1. Application -> Service API contract call
2. Service -> Messaging event publication
3. Service -> Service registered interface call
4. Service -> Workflow orchestration trigger

## Independence Constraint
Interactions SHALL preserve service independence and SHALL NOT create application-owned service behavior.
