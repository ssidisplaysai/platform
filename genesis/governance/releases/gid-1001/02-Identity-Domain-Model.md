# 02 - Identity Domain Model

## Model Objective
Define canonical reusable identity entities for Genesis applications without embedding application-specific authority.

## Entity: Principal
- Definition: Canonical actor root for all identity kinds.
- Ownership: Genesis Identity Platform.
- Required fields: principalId, identityId, kind, workspaceIds, lifecycleState, createdAt, updatedAt.
- Optional fields: displayName, organizationId.
- Lifecycle: PROVISIONING -> ACTIVE -> SUSPENDED/REVOKED -> ARCHIVED.
- Relationships: One principal maps to one active identity subject; may have many memberships, sessions, grants.
- Invariants: principalId immutable; kind immutable after provisioning.
- Security considerations: principal references must be non-secret and auditable.

## Entity: Human Identity
- Definition: Identity subject representing a human user.
- Ownership: Genesis Identity Platform.
- Required fields: identityId, principalId, email, lifecycleState.
- Optional fields: givenName, familyName, locale, timezone.
- Lifecycle: same as principal.
- Relationships: can hold roles/permissions through memberships.
- Invariants: normalized unique email per provider namespace.
- Security considerations: PII protection and audit traceability required.

## Entity: Service Identity
- Definition: Identity subject for service-to-service operations.
- Ownership: Genesis Identity Platform.
- Required fields: identityId, principalId, serviceName, lifecycleState.
- Optional fields: serviceTier.
- Lifecycle: provisioning through retirement.
- Relationships: permissions via grants and policies.
- Invariants: serviceName stable in organizational scope.
- Security considerations: key rotation and least privilege.

## Entity: Agent Identity
- Definition: Identity subject for autonomous or semi-autonomous agents.
- Ownership: Genesis Identity Platform.
- Required fields: identityId, principalId, agentName, lifecycleState.
- Optional fields: metadata.
- Lifecycle: provisioning through archival.
- Relationships: scoped memberships and policy-bound grants.
- Invariants: agent actions must map to auditable principal.
- Security considerations: bounded authority and replay-safe evidence.

## Entity: Application Identity
- Definition: Identity subject representing an application actor.
- Ownership: Genesis Identity Platform.
- Required fields: identityId, principalId, applicationId, lifecycleState.
- Optional fields: metadata.
- Lifecycle: onboarding -> active -> disabled -> archived.
- Relationships: permissions limited by application integration policies.
- Invariants: one canonical principal per app actor identity.
- Security considerations: application identity cannot bypass platform policy gates.

## Entity: Organization
- Definition: Enterprise ownership and trust boundary container.
- Ownership: Business-domain owner, registered by platform.
- Required fields: organizationId, name, lifecycleState.
- Optional fields: legalName.
- Lifecycle: draft -> active -> inactive -> archived.
- Relationships: owns workspaces and principals.
- Invariants: organizationId immutable.
- Security considerations: tenant boundary enforcement.

## Entity: Workspace
- Definition: Operational scope where memberships and permissions apply.
- Ownership: Platform workspace authority.
- Required fields: workspaceId, organizationId, key, displayName, lifecycleState.
- Optional fields: metadata.
- Lifecycle: provisioning -> active -> paused -> archived.
- Relationships: memberships, sessions, policy scope.
- Invariants: workspaceId immutable; key unique in organization.
- Security considerations: cross-workspace isolation.

## Entity: Membership
- Definition: Principal participation and authorization context in a workspace.
- Ownership: Shared: platform records, business owner approves role/permission intent.
- Required fields: membershipId, principalId, workspaceId, roleIds, permissionIds, active, createdAt, updatedAt.
- Optional fields: delegatedByPrincipalId, expiresAt.
- Lifecycle: active -> suspended -> revoked -> expired.
- Relationships: principal, workspace, roles, grants.
- Invariants: no active membership with revoked principal.
- Security considerations: delegation traceability and expiry enforcement.

## Entity: Credential
- Definition: Verification reference used to establish authentication context.
- Ownership: Identity provider domain.
- Required fields: credentialId, kind.
- Optional fields: principalId, providerId, keyReference, issuedAt, expiresAt, revokedAt.
- Lifecycle: issued -> active -> expired/revoked.
- Relationships: authentication request.
- Invariants: secret value is never exposed in public contract.
- Security considerations: secure storage and non-disclosure.

## Entity: Session
- Definition: Time-bounded authenticated continuity token descriptor.
- Ownership: Genesis Identity Platform session service.
- Required fields: sessionId, principalId, identityId, authenticationContextId, issuedAt, expiresAt, active.
- Optional fields: workspaceId, revokedAt.
- Lifecycle: issued -> active -> expired/revoked.
- Relationships: principal, identity, auth context.
- Invariants: session is not identity; session cannot outlive identity lifecycle constraints.
- Security considerations: revocation, expiration, replay controls.

## Entity: Authentication Context
- Definition: Evidence record for identity establishment event.
- Ownership: Authentication service.
- Required fields: authenticationContextId, assuranceLevel, method, authenticatedAt.
- Optional fields: principalId, identityId, providerId, metadata.
- Lifecycle: created on authentication; immutable after issuance.
- Relationships: session and audit records.
- Invariants: immutable evidence payload.
- Security considerations: no secret leakage in metadata.

## Entity: Role
- Definition: Named grouping of permissions.
- Ownership: Business-domain policy owner with platform-governed schema.
- Required fields: roleId, displayName, permissionIds, workspaceScoped.
- Optional fields: metadata.
- Lifecycle: draft -> active -> deprecated -> retired.
- Relationships: memberships, policies.
- Invariants: role is not identity.
- Security considerations: least-privilege role composition.

## Entity: Permission
- Definition: Atomic action authorization descriptor.
- Ownership: Application domain namespace owner.
- Required fields: permissionId, namespace, action, resource.
- Optional fields: description.
- Lifecycle: proposed -> active -> deprecated -> removed.
- Relationships: roles, grants, policies.
- Invariants: permission identifier globally unique by namespace.
- Security considerations: no wildcard elevation without review.

## Entity: Policy
- Definition: Deterministic authorization rule set.
- Ownership: Business-domain policy owner, evaluated by platform service.
- Required fields: policyId, version, effect, priority, conditions, ownerType, ownerId, active.
- Optional fields: metadata.
- Lifecycle: draft -> approved -> active -> superseded.
- Relationships: authorization requests/decisions.
- Invariants: policy versions immutable after activation.
- Security considerations: explainability and deny precedence controls.

## Entity: Grant
- Definition: Positive entitlement assignment.
- Ownership: Policy authority with auditable delegation rules.
- Required fields: grantId, principalId, permissionId, delegated.
- Optional fields: workspaceId, policyId, grantedByPrincipalId.
- Lifecycle: active -> revoked -> expired.
- Relationships: principal, permissions, policy.
- Invariants: grant cannot violate active policy constraints.
- Security considerations: delegated grants require full provenance.

## Entity: Denial
- Definition: Explicit rejected entitlement or request outcome.
- Ownership: Authorization service evidence model.
- Required fields: denialId, principalId, reasonCode, reason.
- Optional fields: permissionId, policyId.
- Lifecycle: created per decision; immutable.
- Relationships: authorization decision.
- Invariants: denial reason code stable and machine-readable.
- Security considerations: human-safe reason with controlled disclosure.

## Entity: Authorization Decision
- Definition: Deterministic result of policy evaluation.
- Ownership: Authorization service.
- Required fields: decisionId, allowed, reasonCode, principalId, resource, action, grants, denials, evaluatedAt.
- Optional fields: workspaceId, policyId.
- Lifecycle: immutable record.
- Relationships: request, policy, audit.
- Invariants: same input under same policy version yields same decision.
- Security considerations: decision evidence auditable and explainable.

## Entity: Identity Provider
- Definition: Internal or external authentication authority endpoint reference.
- Ownership: Platform identity integration authority.
- Required fields: providerId, providerType, displayName, enabled.
- Optional fields: metadata.
- Lifecycle: configured -> enabled -> disabled -> retired.
- Relationships: credential verification, federation links.
- Invariants: provider selection does not alter core identity contracts.
- Security considerations: provider trust boundaries explicit.

## Entity: Federation Link
- Definition: Mapping between Genesis principal and external subject.
- Ownership: Federation service authority.
- Required fields: federationLinkId, providerId, principalId, externalSubjectId, linkedAt, active.
- Optional fields: metadata.
- Lifecycle: linked -> active -> suspended -> unlinked.
- Relationships: principal, identity provider.
- Invariants: one active link per provider+externalSubject in scope.
- Security considerations: unlink/relink audit and replay controls.

## Entity: Audit Record
- Definition: Immutable identity event evidence.
- Ownership: Identity audit sink.
- Required fields: auditId, eventType, occurredAt, outcome, details.
- Optional fields: principalId, workspaceId, actorPrincipalId, correlationId, causationId.
- Lifecycle: append-only.
- Relationships: auth/authz/session/federation events.
- Invariants: records are immutable and time-ordered.
- Security considerations: non-repudiation and forensic utility.
