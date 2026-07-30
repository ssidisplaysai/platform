# Authentication Baseline Inventory

## Baseline Inputs

- Legacy GLW authentication entrypoint: src/lib/glw/auth.ts
- Legacy GLW login action: src/app/glw/login/actions.ts
- Legacy GLW protected routing: src/app/glw/(protected)/layout.tsx
- Identity contract authority: src/platform/identity/contracts/*
- Identity ports authority: src/platform/identity/ports/index.ts

## Baseline Behavioral Contracts

- Credential validation is email/password based for the GLW administrative identity.
- Session cookie name is glw_session.
- Session token format is payload.signature where payload is base64url JSON and signature is HMAC SHA-256 over payload.
- Session TTL is 12 hours.
- Protected GLW routes require a valid GLW session.
- Logout destroys the session cookie.

## Compatibility Assumptions Preserved

- Public GLW auth function names remain unchanged.
- GLW login route behavior and redirect target remain unchanged.
- Cookie path, sameSite, httpOnly behavior remains unchanged.
- Existing GLW and GOP call sites continue to consume the same auth surface.

## Explicit Non-Goals

- No authorization model implementation
- No policy engine introduction
- No federation/SSO protocol support
- No external identity provider integration
