# 16 Implementation Impact

Changed areas:
- integration/reference-validation.ts (new typed model, registry, service, helpers)
- services/foundation.ts (central product validation path and service exposure)
- services/reservation-allocation.ts (optional external request reference checks)
- services/movement.ts (runtime registration inclusion)
- services/lot-serial-expiration.ts (runtime registration inclusion)
- runtime/types.ts (new service contract token)
- tests/inventory/gidt-1001-s3-foundation.test.ts (hook/runtime expectation updates)
- tests/inventory/gidt-1001-s7-external-reference-validation.test.ts (new focused suite)
