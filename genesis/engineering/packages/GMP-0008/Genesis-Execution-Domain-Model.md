# Genesis Execution Domain Model

## Domain Role
Execution is the authoritative record of what manufacturing is doing in time, not what manufacturing should do.

## Core Concepts
- Execution Session
- Execution Activity
- Execution Checkpoint
- Execution Timeline
- Execution Snapshot
- Execution Recovery Record

## Execution Model Fields
- Execution identity
- Referenced Schedule
- Referenced Production Job
- Referenced Operation
- Referenced Routing Version
- Execution timestamps
- Actual Start
- Actual Finish
- Elapsed Time
- Progress
- Status
- Operator references
- Machine references (references only)
- Notes
- Attachments
- Telemetry references

## Boundary Statement
Execution references machines and labor only as descriptive metadata. It does not own or control them.
