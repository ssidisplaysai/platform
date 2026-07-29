# Genesis Commerce Platform WordPress Profile

## Purpose
Store reusable WordPress integration configuration as opaque references.

## Reference Fields
1. baseUrlReference
2. credentialReference
3. authorReference
4. categoryReference
5. postStatusReference
6. featuredImagePolicyReference
7. imageInsertionPolicyReference
8. yoastPolicyReference
9. environmentReference

## Guardrails
1. No passwords or app-password values.
2. No direct WordPress API execution.
3. Validation rejects secret-like payloads.
