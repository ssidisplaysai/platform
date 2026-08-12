# Capability Model

Work Order: EHC-1001
Date: 2026-07-30

## Capability Advertisement

Capability advertisement is generated from:
- declared capabilities from certified EAR registration metadata
- available capabilities provided at evaluation time

## Supported Outputs

- declared capabilities list
- available capabilities list
- unavailable capabilities list
- per-capability status entries

## Validation Rules

- declared capabilities are normalized and deduplicated
- availability is computed only within declared capability scope
- undeclared capabilities are not promoted to declared ownership

## Constitutional Constraint

EHC evaluates and advertises capability availability.

EHC does not own application capability definition authority, which remains in registry registrations.
