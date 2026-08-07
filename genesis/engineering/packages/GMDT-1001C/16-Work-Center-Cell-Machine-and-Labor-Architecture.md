# 16 Work Center Cell Machine and Labor Architecture

## Work Center and Production Cell

Runtime services own:
- work-center identity and status
- production-cell identity and status
- capacity metadata
- assignment constraints
- lifecycle rules

## Machine and Tool Assignment

Machines and tools are represented as Asset references only where Asset Platform is canonical.
- Manufacturing owns operational assignment state and availability semantics needed for execution
- Manufacturing does not own Asset custody

## Labor Assignment

Labor assignment requires person/contact/organization references only.
- assignment state and role are Manufacturing-owned
- employee/person canonical identity, payroll, HR lifecycle, and authentication identity remain external

## Runtime behavior

- assignments are capacity-aware and concurrency-aware
- maintenance or quality hold references may block assignment eligibility
- assignment changes are versioned and auditable
