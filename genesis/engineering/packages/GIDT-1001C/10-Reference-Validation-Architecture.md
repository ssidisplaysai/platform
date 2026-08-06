# 10 Reference Validation Architecture

Reference-validation objective:

- Validate certified foreign platform references through contracts only, without foreign persistence access.

Reference types and policy:

1. Product reference
- Required: yes for RegisterInventoryItem.
- Timing: pre-mutation synchronous validation.
- Cache policy: short-lived positive cache plus strict tenant keying.
- Failure: reject command.
- Stale behavior: revalidate on cache age threshold.
- Audit: record validator source and decision.

2. Product variant reference
- Required: required when item tracks variant-specific stock.
- Timing: pre-mutation.
- Failure: reject command.

3. Organization reference
- Required: required for tenant context linkage where command includes organization scope.
- Timing: pre-mutation.
- Failure: reject command.

4. Document reference
- Required: optional by command type.
- Timing: pre-mutation when provided.
- Failure: reject when required, warn and exclude when optional and policy allows.

5. Knowledge reference
- Required: optional.
- Timing: pre-mutation when provided.
- Failure: reject or drop according to command policy; default reject for authoritative links.

6. Asset reference
- Required: optional unless command explicitly requires asset-bound handling.
- Timing: pre-mutation.
- Failure: reject when required.

7. Commerce order reference
- Required: optional for reservation/allocation correlation.
- Timing: pre-mutation when present.
- Failure: reject if required by command contract.

8. Manufacturing work-order reference
- Required: optional for allocation-to-work flows.
- Timing: pre-mutation when present.
- Failure: reject if required by command contract.

9. Finance classification reference
- Required: optional and approved-scope only.
- Timing: pre-mutation when present.
- Failure: reject unknown or disallowed class.

Adapter architecture:

1. Integration module defines validator interfaces by reference type.
2. ProviderRegistry binds active validator adapters.
3. InventoryReferenceService orchestrates required/optional policy and cache use.

Tenant validation rules:

1. Reference validators must include tenant context.
2. Cross-tenant reference acceptance is prohibited.

No foreign persistence access:

1. Inventory validators call platform contracts only.
2. Inventory does not read or write foreign platform stores.

Failure classes:

1. InventoryReferenceMissing
2. InventoryReferenceInvalid
3. InventoryReferenceTenantMismatch
4. InventoryReferenceUnavailable
5. InventoryReferenceStale

Fallback and fail-closed:

1. Mandatory reference failures reject command.
2. Optional reference failures follow command policy; default fail closed unless explicitly approved optional downgrade path exists.