# GBA-0007 Onboarding Framework

## Onboarding Record Model

1. Lifecycle status: NOT_STARTED, IN_PROGRESS, AT_RISK, READY_FOR_GO_LIVE, COMPLETE.
2. Milestone set captured as deterministic string list.
3. Progress metrics: training, documentation, go-live readiness, adoption checkpoint.
4. Owner and updatedAt fields support operating accountability.

## Baseline Seeding

1. Runtime seeds onboarding records when workspace has no prior onboarding data.
2. Seed incorporates cross-agent operational context to set initial readiness posture.
3. Seed operation emits CUSTOMER_SUCCESS_BASELINE_SEEDED timeline event.

## Operating Cadence

1. Monthly plan review schedule default for seeded records.
2. Go-live threshold under 70 percent is treated as onboarding delay in agent health.
