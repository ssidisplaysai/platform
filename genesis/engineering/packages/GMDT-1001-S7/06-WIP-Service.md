# 06 WIP Service

Service: manufacturing.service.wip

Behavior:
- Initializes per-work-order WIP projection lazily and deterministically.
- Reconciles waiting, in-process, completed, rejected, and rework quantities from execution totals.
- Rejects invalid states and processed quantities above planned bounds.
- Exposes get and list query helpers for read-only consumers.