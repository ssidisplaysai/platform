# 01 C1 Root Cause

## Condition
Hierarchy cycle and loop protections were not explicitly enforced before persistence.

## Root Cause
- Hierarchy updates relied on parent-path composition without graph-wide cycle validation.
- Self-parent, direct cycle, indirect cycle, and recursive ancestor loop checks were incomplete.
- Recovery load did not fail closed on invalid hierarchy topologies.

## Remediation
- Added deterministic hierarchy validation and normalization before persistence.
- Added fail-closed startup validation for persisted hierarchy state.
- Added focused negative tests for self-parent and cycle scenarios.
