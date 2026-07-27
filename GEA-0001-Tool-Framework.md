# GEA-0001 Tool Framework

## Tool Contracts
Defined in src/lib/gea/tool-framework.ts.

1. ToolDefinition: identity, version, capability binding, risk level, enabled status.
2. ToolInvocation: execution-bound call payload.
3. ToolResult: status, structured output/error, completion timestamp.
4. ToolRegistry: list/get/upsert operations.
5. ToolExecutor: execution interface.

## Default Tools
1. genesis.workflow.dispatch
2. genesis.analytics.snapshot
3. genesis.knowledge.search
4. genesis.reporting.generate

## Authorization Rules
1. Tool must be registered and enabled.
2. Tool capability must be in the plan capability scope.
3. Any violation returns denied with explicit reason.

## Runtime Integration
1. Runtime records each invocation as AgentAction.
2. Action result is persisted and also emitted as audit evidence.
