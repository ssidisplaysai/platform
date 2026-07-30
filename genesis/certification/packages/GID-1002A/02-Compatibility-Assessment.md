# Compatibility Assessment

## GLW Compatibility

## Evidence

- GLW auth entrypoint delegates to compatibility adapter while preserving function names.
- Login flow behavior remains unchanged at the user contract level (invalid credential message and redirect target).
- Cookie name, ttl, and key attributes are preserved.
- Session token shape remains payload.signature with HMAC over payload.

## Findings

1. PASS: GLW behavior preserved for login success/failure and redirect semantics.
- Evidence: src/app/glw/login/actions.ts lines 18-30.
- Evidence: tests/identity/glw-login-action.test.ts lines 23-34 and 37-47.

2. PASS: Cookie semantics preserved.
- Evidence: src/platform/identity/config.ts lines 31-33.
- Evidence: src/platform/identity/adapters/glw-auth-compatibility.ts lines 35-39, 79-83, 101.

3. PASS: Session token compatibility preserved.
- Evidence: src/platform/identity/session/glw-session-codec.ts lines 40-42.
- Evidence: tests/identity/cookie-compatibility.test.ts lines 11-25.

4. CONDITION: validateGlwCredentials became async at the entrypoint surface.
- Evidence: src/lib/glw/auth.ts line 15.
- Mitigation: known runtime caller updated to await in login action.
- Evidence: src/app/glw/login/actions.ts line 18.
- Residual risk: any untracked external or future direct call sites expecting sync behavior would regress.

## Conclusion

Compatibility is largely preserved with one interface-shape condition managed in current in-repo call sites.
