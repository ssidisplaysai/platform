# EHC-0003 Readiness and Liveness Specification

Artifact ID: EHC-0003
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority
Owner: Runtime Health Governance

## Purpose

Define constitutional readiness and liveness semantics for enterprise application status interpretation.

## Readiness States

- Ready
- Starting
- Initializing
- Recovering
- Draining
- Stopping
- Offline

## Liveness States

- Alive
- NotAlive
- Recovering
- Restarting
- Unknown

## Status Model

Allowed status values:
- Healthy
- Warning
- Degraded
- Maintenance
- Unavailable
- Retired
- Unknown

## Status Severity Definitions

- Healthy: no known contract-level blockers.
- Warning: non-blocking degradation or reduced confidence.
- Degraded: partial service impairment affecting readiness or capability commitments.
- Maintenance: planned non-standard operation with governed maintenance intent.
- Unavailable: no governed operational availability.
- Retired: intentional and governed permanent removal from active operation.
- Unknown: insufficient evidence to classify reliably.

## Transition Rules

Status transitions SHALL follow operational truth and audit requirements.

Examples:
- Healthy -> Warning
- Warning -> Degraded
- Degraded -> Healthy
- Healthy -> Maintenance
- Maintenance -> Healthy
- Any -> Unavailable
- Active lifecycle -> Retired status only via lifecycle retirement governance

Forbidden transitions:
- Retired -> Healthy without lifecycle re-activation approval.

## Enterprise Reporting Behavior

1. Genesis SHALL aggregate status by declared severity.
2. Genesis SHALL report Unknown when contract evidence is insufficient.
3. Genesis SHALL not reinterpret application-internal causes beyond declared contract semantics.
