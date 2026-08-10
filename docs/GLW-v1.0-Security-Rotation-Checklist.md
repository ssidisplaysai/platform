# GLW v1.0 Security Rotation Checklist

Status: COMPLETE
Scope: Post-troubleshooting credential hygiene and authentication hardening

## Required Actions

1. Rotate the WordPress database password at the database/hosting layer. COMPLETE
2. Update `DB_PASSWORD` in production `wp-config.php`. COMPLETE
3. Verify WordPress database connectivity after password rotation. COMPLETE
4. Generate a fresh set of WordPress authentication keys and salts. COMPLETE
5. Replace all 8 auth keys/salts in production `wp-config.php`. COMPLETE
6. Confirm expected session invalidation behavior (active sessions will be logged out). COMPLETE
7. Validate end-to-end after rotation: COMPLETE
   - Frontend page load
   - wp-admin login
   - REST API responses
   - n8n WordPress authentication flows
8. Confirm no automation regressions in credential-dependent jobs. COMPLETE

## Validation Checklist

- [x] Frontend returns expected HTTP status and renders content.
- [x] wp-admin login succeeds for authorized users.
- [x] REST endpoints continue returning expected responses.
- [x] n8n WordPress create/update nodes authenticate and execute successfully.
- [x] GLW publish and draft flows continue to complete with callback success.

Verification summary:
- Frontend: PASS
- wp-admin: PASS
- REST API: PASS
- n8n WordPress authentication: PASS
- GLW automation validation: PASS
- Public PHP warning suppression: PASS

## Notes

- Do not store secret values in repository files.
- Perform rotation directly in secured production systems.
- Record completion in an operations audit log external to this repository.
