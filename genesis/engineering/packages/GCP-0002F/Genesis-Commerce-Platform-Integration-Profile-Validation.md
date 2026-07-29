# Genesis Commerce Platform Integration Profile Validation

## Validation Domains
1. Profile creation/update input validity.
2. Immutable profile identity/organization/type enforcement.
3. Secret-like value rejection.
4. Binary payload rejection.
5. Assignment integrity validation.
6. Organization/type consistency across assignments.

## Secret and Payload Guardrails
1. Secret-like keywords (password, secret, token, apikey, private key) are rejected.
2. Inline binary payload patterns are rejected.
3. References must be non-empty when provided.

## Assignment Validation
1. Referenced profile must exist.
2. Assignment organization must match profile organization.
3. Assignment profileType must match referenced profileType.
4. Duplicate target/type assignment combinations are rejected.
