# Compatibility Report

## GLW Surface Compatibility

Preserved exported GLW auth function names in src/lib/glw/auth.ts:

- validateGlwCredentials
- createGlwSession
- getGlwSession
- destroyGlwSession

## Cookie and Session Compatibility

- Cookie name preserved: glw_session
- Cookie attributes preserved: httpOnly, sameSite=lax, path=/
- TTL preserved: 12 hours
- Token shape preserved: base64url(payload).hmacSignature

## Login Flow Compatibility

- Login action retains existing error message and redirect behavior.
- Authentication check became awaited due to service delegation, preserving outcome semantics.

## Regression Risk Review

- Primary risk: sync to async transition for validateGlwCredentials call sites.
- Mitigation: only active login call site updated to await; repository search confirmed no additional call site usage requiring change.
