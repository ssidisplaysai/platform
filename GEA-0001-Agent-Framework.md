# GEA-0001 Agent Framework

## Objective
Deliver Genesis Enterprise Agent Framework (GEA) v1.0 as a constitutional runtime layer for enterprise agents with deterministic planning, default-deny permissions, auditable execution, and replay validation.

## Scope Delivered
1. Domain model and deterministic helpers in src/lib/gea/agent-models.ts.
2. Capability catalog and resolver in src/lib/gea/capability-registry.ts.
3. Tool registry, authorization, and execution contracts in src/lib/gea/tool-framework.ts.
4. Permission evaluation engine in src/lib/gea/permission-engine.ts.
5. Planning and dependency ordering engine in src/lib/gea/planning-engine.ts.
6. Reproducible context assembly in src/lib/gea/context-builder.ts.
7. Runtime orchestration service in src/lib/gea/agent-runtime.ts.
8. Persistence abstraction with Prisma and in-memory backends in src/lib/gea/agent-repository.ts.
9. Auth-gated API surface in src/lib/gea/agent-api.ts and src/app/api/gea/*.
10. Protected workspace experience in src/app/glw/(protected)/agents/* and src/components/gea/gea-workspace.tsx.

## Constitutional Controls
1. Default-deny permission decisioning for capability and tool execution.
2. Explicit approval checkpoints for high-governance tasks.
3. Immutable plan guard once execution starts.
4. Full audit event stream across queue/run/task/control/replay actions.
5. Deterministic replay checksum generation for post-run integrity checks.

## Platform Integration
1. GEA route and navigation registration added in src/platform/gop/adapters/glw.ts.
2. GEA action policies added to src/platform/gop/auth/policies.ts.
3. Additive persistence models added to prisma/schema.prisma.
4. Additive migration prepared at prisma/migrations/20260727190000_gea_enterprise_agent_framework_v1/migration.sql.

## Out Of Scope
1. No database migration apply step was executed (migration staged and pending).
2. No code commits or pushes were performed.
3. No work beyond GEA-0001 was started.
