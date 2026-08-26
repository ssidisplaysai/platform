# Runtime Ownership And Epoch Protocol

Status: Conceptual contract; no host state is created

## State

The future host record contains `OwnerId`, `OwnershipEpoch`, `DeploymentEpoch`, `LeaseId`, `AcquiredAtUtc`, `ExpiresAtUtc`, `Operation`, `ReleaseIdentityHash`, and `CorrelationId`. Epochs are positive monotonic integers. IDs are immutable for one acquisition.

## Mutation Protocol

Acquisition is an atomic compare-and-swap from unowned state at known epochs. Renewal is allowed only to the current owner and cannot change operation or release identity. Normal release clears the owner and increments `OwnershipEpoch`. Deployment or rollback increments `DeploymentEpoch` before publishing a new release identity and again only through the same coordinator.

Expired or crashed owners are never silently replaced. The state becomes reconciliation-required; a governed operator must prove the prior operation stopped before advancing the epoch. Task Scheduler, deployment, rollback, manual operators, and any future supervisor mutation must use the same coordinator.

## OA-01 Read-Only Algorithm

1. Read `OwnershipEpoch`.
2. Read `DeploymentEpoch`.
3. Collect release, task, launch, instance, process, and supplemental port evidence.
4. Re-read `OwnershipEpoch`.
5. Re-read `DeploymentEpoch`.
6. Reject when either value changed, cannot be read coherently, or is malformed.

This double-read protocol is sufficient for read-only identity verification only. It does not acquire a lease, authorize mutation, or permit process, task, deployment, port, journal, or service control.