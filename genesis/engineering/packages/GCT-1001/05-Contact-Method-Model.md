# 05 Contact Method Model

## Supported Methods
- `EMAIL`
- `PHONE`
- `POSTAL`

## Canonicalization
- Email normalization: trim + lowercase
- Phone normalization: strip non-numeric characters except leading plus
- Postal normalization: normalized multi-field key with uppercase country code

## Hardening Rules
- Duplicate method key prevention by normalized value and type
- Primary uniqueness per method type with explicit primary reassignment
- Verification transitions for email/phone
- Validity transitions for all method types
- Effective date support (`effectiveFrom`, `effectiveTo`)
- Method-level consent references for email/phone

## Determinism
Method comparison and duplicate checks use normalized deterministic keys.
