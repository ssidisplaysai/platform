# 12 Readiness and Failure Model

Readiness requires:
- Valid runtime options.
- Required provider capabilities.
- Required runtime-level services.
- Product integration port registration.
- Inventory integration port registration.
- Shared lifecycle start success.
- No blocking initialization failure.

Slice 2 runtime failure taxonomy:
- INVALID_RUNTIME_OPTIONS
- INVALID_RUNTIME_STATE
- DUPLICATE_INITIALIZATION
- MISSING_REQUIRED_PROVIDER
- DUPLICATE_PROVIDER
- DUPLICATE_SERVICE_REGISTRATION
- DUPLICATE_INTEGRATION_REGISTRATION
- MISSING_REQUIRED_INTEGRATION
- LIFECYCLE_START_FAILURE
- LIFECYCLE_STOP_FAILURE
- PARTIAL_INITIALIZATION_REJECTED
- RUNTIME_NOT_READY
- INTEGRATION_REGISTRATION_FAILURE
