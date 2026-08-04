# 09 Identity Authorization and Organization Integration

## Identity Boundary
Contact consumes identity-resolution dependency contract only. Contact does not own credentials, users, or authentication flows.

## Authorization Boundary
Contact consumes authorization dependency for registration and mutation policy gates. Contact does not own platform authorization policies.

## Organization Boundary
Contact validates organization references via organization runtime adapter. Contact does not mutate organization entities and does not own organization lifecycle.

## Tenant Integrity
Registration, affiliation, merge, and recovery flows enforce tenant-aware constraints and cross-tenant rejection.
