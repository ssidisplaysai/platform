# HR004 Production Runtime Identity and Ownership

Status: Proposed prerequisite contract
Authority: HR004 OA-00A

## Purpose

Define repository-governed identity, ownership, task, trust, and audit contracts required before read-only production runtime identity verification can be implemented.

## Scope

OA-00A defines schemas and specifications only. It does not inspect or alter a host, emit production descriptors, install a launcher or task, observe production processes, write an operational journal, or implement OA-01.

## Current Ownership

The documented lifecycle owner is Windows Task Scheduler task `Genesis Production Server`, together with governed deployment, rollback, and operator procedures. The external `start-genesis.ps1` and installed task definition are not currently repository-governed.

## Trust Boundaries

Repository authority defines approved schemas and configuration. Host authority installs configuration, applies ACLs, issues runtime-instance evidence, maintains ownership epochs, and records audit events. Repository declarations are not proof that installed host state conforms.

The target runtime is outside the identity trust root. Runtime self-asserted identity, health responses, environment values, command lines, and port ownership are supplemental evidence only and cannot independently establish authority over the process.

## Identity Decomposition

1. `ProductionReleaseIdentity` is static deployment-issued release identity.
2. `ProductionRuntimeLaunchIdentity` binds an approved release to repository-governed lifecycle configuration and ownership epochs.
3. `ProductionRuntimeInstanceIdentity` is ephemeral launcher-issued process identity. It contains PID and process creation time; those fields do not belong in the static release identity.
4. `ProductionRuntimeIdentityVerification` is verifier-produced, non-authorizing evidence with closed statuses `Verified`, `Absent`, `Ambiguous`, and `Rejected`.

Descriptors use canonical JSON serialization and SHA-256 hashes. A hash detects content changes but is not a signature or trust root. Trust also requires approved issuers, ACL validation, current epochs, and live OS evidence.

## Semantic Separation

`SupervisorRecoveryDisposition` is not an input to identity verification. Runtime identity is independent of whether recovery was requested. The certified semantic chain remains terminal and its authorization remains exactly `NotRequested` or `Denied`.

## Ownership And Deployment Epochs

Ownership and deployment epochs are monotonic host-governed values. OA-01 reads both epochs before collecting evidence and again afterward. Any change rejects verification as raced. This double-read protocol is sufficient only for read-only verification and grants no mutation authority.

## Task And Startup Governance

The repository declares expected task identity, principal, triggers, policies, working directory, startup path and hash, release-root template, environment-source identity, port, arguments, and logs. Installed state remains machine-local and must be compared with this declaration without modification.

## ACL Requirements

The runtime and supervisor cannot write release, launch, instance, ownership, task, startup, or prior audit evidence. Deployment or the lifecycle owner writes only its assigned artifacts. Unknown ownership, inherited write access, or ACL mismatch fails closed.

## Audit Requirements

The preferred future sink is ACL-protected append-only structured JSONL, optionally mirrored to Windows Event Log. OA-00A defines `RuntimeVerificationAuditEvent` but creates no writer and writes no production journal.

## OA-01 Dependencies

OA-01 requires separately certified deployment descriptor emission, governed task/startup installation, host ACLs, ownership/deployment epoch storage, launcher-issued instance identity, read-only OS evidence, and a verification audit sink.

## Non-Authority Guarantees

OA-00A grants no operational runtime authority. It adds no positive recovery authorization, process or scheduler authority, native API, capability, deployment behavior, journal writer, service, network control, polling, retry, background task, or runtime consumer.