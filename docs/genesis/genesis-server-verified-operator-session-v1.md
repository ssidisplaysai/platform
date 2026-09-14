# Genesis Server-Verified Operator Session V1

Genesis operator authentication is independent of WordPress integration credentials. Human operators authenticate against the server-owned directory in `GENESIS_OPERATOR_DIRECTORY_JSON`; WordPress application passwords never create Genesis sessions.

## Directory

The environment value is a JSON array. Identities are deployment configuration, not source-code authorization constants.

```json
[{"principalId":"stable-operator-id","email":"operator@example.com","roles":["platform_admin"],"passwordHash":"scrypt$<base64url-salt>$<base64url-hash>","enabled":true}]
```

Generate hashes through the exported `createScryptPasswordHash` provisioning function in a trusted administrative process. Never place plaintext passwords or session tokens in environment files, logs, persistence, commits, URLs, or browser storage.

## Session Contract

- `genesis_operator_session`: opaque 256-bit random bearer cookie, `HttpOnly`, `SameSite=Strict`, bounded to 3,600 seconds by default, and `Secure` whenever the request is HTTPS.
- Only the SHA-256 token digest is persisted. Session records include an independent server-generated session ID, principal ID, authentication time, expiration, CSRF digest, and revocation time.
- Roles are loaded from the server directory on every request. Capabilities are derived from the server role-permission matrix.
- `genesis_operator_csrf`: readable same-site CSRF cookie. Mutations require the matching `x-genesis-csrf-token` header, same-origin `Origin`, and a valid unrevoked session.
- Session A and session B remain distinct even for the same principal. Owner grants bind both principal ID and session ID.

## Legacy Headers

| Header | Classification |
|---|---|
| `x-gcp-roles` | Ignored for production authentication/authorization; explicit test-only injection under `NODE_ENV=test` |
| `x-gcp-principal-id` | Ignored in production; test-only synthetic principal input |
| `x-gcp-session-id` | Ignored in production; test-only synthetic session input |
| `x-gcp-owner`, `x-gcp-email`, `x-gcp-user` | Never authentication authority |
| `x-gcp-organization-id`, `x-gcp-site-id` | Request scope only; cannot authenticate or grant a capability |

## GLW Reference Authority Integration

Agent 2's `resolveGlwTrustedOperatorPrincipal(request)` contract is implemented at `src/modules/glw/trusted-operator-principal.ts`. It returns the stable `principalId`, server session `sessionId`, and `GENESIS_SERVER_SESSION_V1` authority label. Missing, expired, tampered, revoked, or directory-disabled sessions return `TRUSTED_OPERATOR_SESSION_UNAVAILABLE`; role headers cannot change that result.