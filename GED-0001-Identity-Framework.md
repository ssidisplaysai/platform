# GED-0001 Identity Framework

## Purpose
Identity is deterministic and replay-safe across the enterprise model.

## Identity Rules
1. Every entity has a stable canonical key.
2. Every persisted record has a deterministic identifier.
3. Version records are checksum-backed.
4. Audit lineage is immutable.

## Identifier Form
Canonical GED identifiers use a stable prefix plus a deterministic checksum suffix.
