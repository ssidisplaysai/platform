# 07 - Identity Versioning and Migration Model

## Versioning Scope
- Contract versioning
- Schema versioning
- Provider adapter versioning
- Session and permission compatibility
- Policy and application migration sequencing

## Contract Versioning
- Canonical contract baseline: gid-1001.v1
- Semantic contract version: 1.0.0
- Rules:
  - Additive fields: minor version increments.
  - Breaking changes: major version increments with migration plan.
  - Deprecated fields: explicit deprecation window and compatibility adapter guidance.

## Schema Versioning
- Each persisted identity artifact carries schemaVersion.
- Read path must support current and immediately previous schema versions.
- Write path emits current schema version only.

## Provider Adapter Versioning
- Provider adapters publish adapter version and supported contract versions.
- Contract mismatch returns CONTRACT_MISMATCH.
- Adapter upgrades require compatibility regression evidence.

## Session Compatibility
- SessionDescriptor is versioned and backward-compatible for one prior version.
- Session validation supports mixed-version reads during migration windows.
- Revocation semantics remain stable across versions.

## Permission Compatibility
- Permission identifiers are additive within namespace.
- Permission removals require deprecation period and audit impact review.
- Alias mapping may be used during migration.

## Policy Migration
- Policies are immutable by version once active.
- New versions are introduced additively.
- Rollback reactivates previous policy version with audit continuity.

## Application Migration
- Applications declare consumed identity contract versions.
- Migration sequence:
  1. Add adapter compatibility.
  2. Enable dual-read mode.
  3. Cut over write path.
  4. Retire legacy adapter after evidence window.

## Legacy Compatibility Adapters
- Temporary adapters may map existing app-local auth/session behavior to platform contracts.
- Adapters are transitional and must carry retirement target.

## Deprecation Periods
- Minimum recommended deprecation period: 2 release cycles.
- Exception requires governance approval and risk sign-off.

## Rollback
- Rollback plans are required for all version transitions.
- Rollback must preserve audit continuity and contract integrity.

## Audit Continuity
- Correlation IDs and principal references must remain stable across migrations.
- Historical decision evidence is immutable and additive.

## Additive Certification History
- New identity versions append certification evidence.
- Existing certified history is never rewritten.

## GLW Future Migration Concept (No Migration Executed in GID-1001)
- Stage A: Wrap current GLW session/credential flow with compatibility adapter.
- Stage B: Introduce platform session descriptors and policy-resolution ports.
- Stage C: Migrate GLW route/API checks to identity platform contracts.
- Stage D: Retire GLW-local authentication path after certification closure.
