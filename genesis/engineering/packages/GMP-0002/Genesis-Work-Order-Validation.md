# Genesis Work Order Validation

## Validation Domains
- New work-order creation payloads
- Draft update payloads
- Source lineage completeness
- ISO timestamp safety checks
- Positive revision and quantity constraints
- Secret-like payload token rejection

## Failure Model
Validation returns a structured result:
- valid: boolean
- issues: list of field + message entries

## Key Guarantees
- Work-order creation requires complete commercial lineage
- Quantities and revisions must be positive and coherent
- Date fields must be parseable ISO values when provided
- Rejects suspicious secret-like text to reduce accidental credential leakage
