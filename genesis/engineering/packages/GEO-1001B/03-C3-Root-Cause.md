# 03 C3 Root Cause

## Condition
Tenant boundary integrity controls were incomplete for hierarchy and relationship links.

## Root Cause
- Tenant reference validation was not strictly enforced in registration/recovery.
- Cross-tenant hierarchy links were not rejected.
- Cross-tenant relationship creation was not rejected.

## Remediation
- Added tenant existence/reference validation with fail-closed behavior.
- Added cross-tenant hierarchy rejection.
- Added cross-tenant relationship rejection.
- Added negative tests for invalid tenant references and cross-tenant linking.
