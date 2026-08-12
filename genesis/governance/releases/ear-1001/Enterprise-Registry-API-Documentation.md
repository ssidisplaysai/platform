# Enterprise Registry API Documentation

Work Order: EAR-1001
Date: 2026-07-30

## Base Routes

- GET /api/ear/registry
- POST /api/ear/registry
- GET /api/ear/registry/{applicationId}
- PATCH /api/ear/registry/{applicationId}
- DELETE /api/ear/registry/{applicationId}
- POST /api/ear/registry/{applicationId}
- POST /api/ear/registry/validate
- GET /api/ear/registry/{applicationId}/health-reference
- GET /api/ear/registry/{applicationId}/capabilities

## Route Semantics

1. List applications
- GET /api/ear/registry
- query filters: lifecycleState, capability, ownerOrganization, q, limit

2. Register application
- POST /api/ear/registry
- body: RegisterApplicationInput

3. Lookup application
- GET /api/ear/registry/{applicationId}

4. Update registration
- PATCH /api/ear/registry/{applicationId}
- body: UpdateRegistrationInput

5. Deactivate application
- DELETE /api/ear/registry/{applicationId}
- optional body: { reason: string }

6. Validate lifecycle transition
- POST /api/ear/registry/{applicationId}
- body: { nextState: "REGISTERED" | "ACTIVE" | "INACTIVE" | "DEPRECATED" }

7. Validate registration
- POST /api/ear/registry/validate
- default mode, body: RegisterApplicationInput

8. Validate compatibility
- POST /api/ear/registry/validate?mode=compatibility
- body: CompatibilityValidationInput

9. Health reference lookup
- GET /api/ear/registry/{applicationId}/health-reference

10. Capability lookup
- GET /api/ear/registry/{applicationId}/capabilities

## Response Model

- success payloads include application, applications, validation, healthReference, or capabilities
- failure payloads include error or validation issues
