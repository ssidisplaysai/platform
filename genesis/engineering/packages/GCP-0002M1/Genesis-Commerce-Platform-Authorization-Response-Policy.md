# Genesis Commerce Platform Authorization Response Policy

## Purpose
Define consistent API authorization and scope response behavior for bounded Commerce Platform foundation APIs.

## Policy
- `401 Unauthorized`
  - Returned when request has no valid authenticated application identity.
  - Current identity contract: missing or invalid `x-gcp-roles` header.
- `403 Forbidden`
  - Returned when request is authenticated but lacks required capability.
  - Returned when authenticated request fails required organization/site scope checks for collection operations.
- `404 Not Found`
  - Returned for missing resources.
  - Returned for out-of-scope detail resources where non-disclosure is required.
- `400 Bad Request`
  - Returned for malformed request payloads or missing required request parameters under existing conventions.
- `422 Unprocessable Entity`
  - Not introduced in this package because repository conventions currently use `400` for validation/state processing errors.

## Error Payload Contract
- Minimal contract preserved:
  - `{ "error": "Unauthorized" }`
  - `{ "error": "Forbidden" }`
  - `{ "error": "<Domain Not Found Message>" }`
  - `{ "error": "Validation Error", "detail": "..." }`
  - `{ "error": "Validation Error", "issues": [...] }`

## Information Disclosure Guard
- APIs SHALL NOT return stack traces.
- Detail routes SHALL return `404` for out-of-scope resources.
- Capability/scope internals SHALL NOT be echoed in response payloads.

## Conformance Notes
- R1A introduced strict auth enforcement via shared auth helper in API routes.
- Existing write-path error conventions are preserved.
