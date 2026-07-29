# Genesis Commerce Platform Site Readiness Policy

## Readiness Output Contract
Readiness evaluation returns:
1. ready
2. status
3. blockingReasons
4. warnings
5. checkedConditions
6. checkedAt

## Conditions Evaluated
1. site_enabled
2. lifecycle_permits_operation
3. domain_present
4. wordpress_api_present
5. credential_reference_present
6. workflow_reference_present
7. health_acceptable
8. environment_permits_action
9. publishing_state_permits_action
10. profiles_present
11. organization_active
12. user_has_site_permission

## Deterministic Rules
1. Publishing readiness is never inferred from one boolean.
2. Publish intent requires lifecycle active and publishing status ready.
3. Workflow reference requirement is caller-configurable by intent.
4. Readiness blockers are explicit and explainable.

## Publishing Guard
The publishing guard consumes readiness policy with publish intent and rejects publication when any blocking condition fails.

## Truthful Availability
Connection checks and publish readiness remain truthful when external integrations are unavailable or unconfigured.
