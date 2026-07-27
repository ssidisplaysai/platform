# Security Model

Status: Frozen by GOP-0004A

## 1. Authentication Boundary

Runtime APIs are session protected for operator access.

Current baseline:

- GLW session validation gates protected runtime endpoints
- unauthorized requests receive 401 responses

## 2. Authorization Boundary

Authorization is policy-driven and evaluated against:

- subject role
- workspace membership
- module context
- action type
- resource attributes

Frozen rule:

- default-deny when no allow policy matches

## 3. Workspace Isolation

Workspace identity is explicit in runtime models and operations snapshots.

Frozen constraints:

- operations and execution views are scoped to workspace
- workspace membership is required for authorized access

## 4. Execution Ownership

Ownership control points:

- ownerActorId for resource checks where provided
- role and policy constraints for mutation actions

Viewer restrictions and policy-driven action denials remain in force.

## 5. Worker Trust Boundary

Current trust model:

- worker management endpoints are user-session controlled
- no external machine identity protocol is introduced in GOP-0004A

Deferred trust enhancements:

- signed worker identity
- mutual TLS or token-based service trust

## 6. API Trust Boundary

API trust assumptions:

- only validated, authorized endpoints mutate runtime state
- malformed payloads are rejected

This applies to operations, worker, event, and execution surfaces.

## 7. Event Trust Boundary

Event integrity controls:

- required field validation
- per-job transactional ordering lock
- correlation consistency checks
- late non-terminal rejection after terminal status

## 8. Audit Boundary

Audit sources:

- durable event records
- execution retry history
- notifications and operations snapshots

Deferred:

- centralized immutable audit ledger across services

## 9. Constitutional Security Constraints

Forbidden without constitutional amendment:

- bypassing authorization for runtime control endpoints
- removing workspace scope from runtime views
- weakening event integrity guarantees
- changing callback trust model without migration path
