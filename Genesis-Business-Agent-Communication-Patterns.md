# Genesis Business Agent Communication Patterns

## Purpose
Standardize request/response, publish/subscribe, event, and notification behavior between Business Agents.

## Pattern 1: Request/Response
1. Use when a consumer needs current intelligence from an owning agent.
2. Consumer calls the owner's runtime/API contract.
3. Response is read-only from consumer perspective.
4. Consumer never mutates producer-owned state.

## Pattern 2: Publish/Subscribe
1. Use when producers broadcast intelligence updates or alerts.
2. Producer publishes recommendation, KPI, health, or timeline events.
3. Subscribers consume signals asynchronously.
4. Subscribers may enrich their own intelligence but not mutate producer records.

## Pattern 3: Read-Only Cross-Agent Consumption
1. Consumers reference producer outputs for synthesis decisions.
2. Consumers cache/snapshot data only for their own computations.
3. Ownership and mutation rights remain with producer.

## Pattern 4: Shared Runtime Services
1. Runtime infrastructure supports orchestration, authorization, and event delivery.
2. Shared runtime does not weaken agent ownership isolation.
3. Agent service boundaries remain explicit despite common runtime substrate.

## Pattern 5: Recommendation Propagation
1. Producer creates recommendation records.
2. Recommendation status lifecycle remains producer-owned.
3. Other agents and Executive may consume recommendation summaries.
4. Recommendation consumption never grants mutation rights.

## Pattern 6: Executive Aggregation
1. Executive consumes published outputs from all functional agents.
2. Executive produces enterprise-level narrative, risk, and priority alignment.
3. Executive does not overwrite source agent intelligence.

## Pattern 7: Health Reporting
1. Each agent computes and publishes its own health state.
2. Health payloads include deterministic evidence lineage.
3. Executive aggregates health across agents.

## Pattern 8: Event Routing
1. Events are routed with source agent, subject, actor, summary, and lineage.
2. Event consumers treat source payloads as immutable facts.
3. Replay should preserve deterministic behavior under equivalent state.

## Pattern 9: Notification Routing
1. Notifications are derived from published events or recommendations.
2. Notification orchestration is runtime/application responsibility.
3. Notifications do not imply ownership transfer.

## Pattern 10: Background Processing
1. Long-running synthesis and aggregation may execute asynchronously.
2. Background jobs must preserve idempotency for retries and replay.
3. Failure handling must not violate ownership boundaries.

## Communication Anti-Patterns (Prohibited)
1. Direct repository access across agent boundaries.
2. Consumer-side mutation of producer recommendation status.
3. Event payload mutation by subscribers.
4. Hidden dependency on non-contractual internal fields.
