# GLW v1.0 Security Rotation Checklist

Status: REQUIRED (not executed in this repository task)
Scope: Post-troubleshooting credential hygiene and authentication hardening

## Required Actions

1. Rotate the WordPress database password at the database/hosting layer.
2. Update `DB_PASSWORD` in production `wp-config.php`.
3. Verify WordPress database connectivity after password rotation.
4. Generate a fresh set of WordPress authentication keys and salts.
5. Replace all 8 auth keys/salts in production `wp-config.php`.
6. Confirm expected session invalidation behavior (active sessions will be logged out).
7. Validate end-to-end after rotation:
   - Frontend page load
   - wp-admin login
   - REST API responses
   - n8n WordPress authentication flows
8. Confirm no automation regressions in credential-dependent jobs.

## Validation Checklist

- [ ] Frontend returns expected HTTP status and renders content.
- [ ] wp-admin login succeeds for authorized users.
- [ ] REST endpoints continue returning expected responses.
- [ ] n8n WordPress create/update nodes authenticate and execute successfully.
- [ ] GLW publish and draft flows continue to complete with callback success.

## Notes

- Do not store secret values in repository files.
- Perform rotation directly in secured production systems.
- Record completion in an operations audit log external to this repository.
