# GMP-0003: Genesis Production Job Foundation

## Objective
Implement the Genesis Production Job aggregate as the authoritative execution unit for manufacturing release and lifecycle governance.

## Scope Delivered
- Production Job aggregate contract and persistence repository.
- Validation, deterministic lifecycle, revisions, timeline, audit, and published enterprise events.
- Authorization integration, organization/site scope enforcement, and permission matrix updates.
- API routes for create, conversion from Work Order, search, detail, update, release, pause/resume/start, cancel, timeline, audit, and revisions.
- Foundation UI views and app routes for registry, detail, lineage, timeline, revisions, audit, and summary.
- Manufacturing lineage propagation from Quote -> Sales Order -> Work Order -> Production Job.

## Explicitly Out Of Scope
- Operations execution workflows.
- Machine execution controls.
- Scheduling optimization or dispatch logic.
- Inventory execution mutations.
- Quality execution or NCR flows.
- MES/IoT integrations.

## Certification Intent
This package establishes bounded production-job foundation capabilities suitable for certification recommendation after validation evidence is collected.
