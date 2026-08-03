# 02 Architecture

Architecture summary:
- Business applications sit above Genesis AI Orchestration.
- AI Orchestration coordinates Workflow, Scheduling, and Notifications rather than replacing them.
- Messaging, Identity, and Authorization remain lower-level platform boundaries.
- Mission Control observes the AI layer through health and metrics snapshots.

Implementation posture:
- The AI layer is contract-first and provider-neutral.
- The foundation uses in-memory registries and adapters only.
- The architecture is intentionally scoped to orchestration, not business-object ownership.
