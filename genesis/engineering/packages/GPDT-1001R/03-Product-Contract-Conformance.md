# 03 Product Contract Conformance

Remediation summary:

1. Product contract now requires:
- productId
- productCode
- versionIdentifier
- displayName
- lifecycleState
- tenantId
- metadata
- productFamilyId
- categoryId

2. ProductCode normalization and uniqueness:
- ProductCode normalized to uppercase.
- Uniqueness enforced deterministically in tenant scope.

3. VersionIdentifier conformance:
- Required on product creation.
- Required for lifecycle transition concurrency checks.

4. Immutable-field protection:
- productId, productCode, and versionIdentifier immutable in metadata revision path.
- Violations fail closed with IMMUTABLE_FIELD.

5. Persistence recovery validates same invariants to prevent invalid-state startup.
