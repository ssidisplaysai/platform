# GBA-0006 General Ledger Framework

## Data Model
`GbaFinanceGeneralLedgerEntry` stores period journal postings with account code, debit, credit, and audit reference.

## Read Surfaces
- `GET /api/gba/finance/general-ledger`
- Workspace route: `/glw/finance-agent/general-ledger`

## Governance
- Protected by `gba:finance:view_general_ledger` action.
- Workspace-scoped authorization with module `gba.finance`.
- Route-level access decisions are default deny when permission is missing.
