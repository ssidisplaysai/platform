# Mission Control Launch Policy (GMC-1001B)

Version: 1.0
Effective Date: 2026-07-30
Authority: GMC service layer

## Policy Rules
1. Launch execution is allowed only when all of the following are true:
   - Application registrationStatus is ACTIVE
   - Application health is available (not UNAVAILABLE and not NOT_LIVE)
   - Compatibility is true
   - Launch metadata resolves to a safe target
2. Launch execution is blocked with explicit reason when a rule fails.
3. Blocked launch metadata must not include an executable target.
4. UI must render launch controls from server-authoritative metadata only.
5. API must fail safely for blocked launches.

## Allowed Target Rules
1. Internal targets:
   - Must start with one leading slash
   - Must not be protocol-relative
   - Must not contain backslashes
   - Must not contain control characters
2. External targets:
   - Only http and https schemes are eligible
   - URL must parse successfully
   - URLs with embedded credentials are rejected
   - http is restricted to loopback hosts (localhost, 127.0.0.1, ::1)
   - Non-http schemes are rejected

## Status Mapping
- ALLOWED
- BLOCKED_INACTIVE
- BLOCKED_UNAVAILABLE
- BLOCKED_INCOMPATIBLE
- BLOCKED_MISSING_METADATA
- BLOCKED_INVALID_TARGET

## API Contract Behavior
1. Unknown applicationId returns 404.
2. Blocked launch returns 409 with launch metadata and block reason.
3. Allowed launch returns 200 with launch metadata and safe target.

## Presentation Requirements
1. If launchAllowed is false:
   - No anchor href or executable action is rendered
   - Block reason text is shown
2. If launchAllowed is true:
   - Launch anchor uses safeLaunchTarget
   - External launch opens in a separate browser context with noreferrer
