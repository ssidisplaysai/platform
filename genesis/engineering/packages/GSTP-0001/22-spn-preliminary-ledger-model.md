# SPN Preliminary Ledger Model

## Partner-Visible Ledger Scope
May include:
- own transactions
- own commissions
- own adjustments
- own payout history
- own credit history
- pending balances
- direct sponsored-partner aggregates
- sponsor overrides
- return and chargeback impacts
- inactivity and progress state

Must exclude unauthorized exposure of:
- customer names and addresses where prohibited
- payment information
- tax records
- private earnings of unrelated partners
- unrelated sales data

## Administrative Ledger Scope
May include:
- attribution evidence and decisions
- commission calculations and rule versions
- manual adjustments and reversals
- disputes, suspensions, reactivations
- payout modifications
- identity changes
- QR reassignment
- fraud findings
- returns and chargebacks
- administrative actor, timestamps, reason, approvals

## Ledger Invariant
Ledger is append-only in principle.
Corrections must not silently rewrite prior records.
