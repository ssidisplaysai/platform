# Genesis Quote Conversion Contract

## Purpose
Define a bounded handoff contract from Quote to a downstream Sales Order domain without implementing downstream orchestration in GCP-0002H.

## Contract
- targetDocumentType: sales_order
- requested: boolean
- requestedAt: string | null
- requestedBy: string | null
- status: not_requested | requested

## Preconditions
- Quote commercial status must be accepted.
- Caller must hold quotes:convert permission.

## Outcome
- Quote transitions to converted.
- Conversion contract status becomes requested.
- Downstream handling remains external to this milestone.
