# 03 Agent and Prompt Assessment

Agent model:
- Agent registry supports metadata, capabilities, permissions, default model, default prompt, tool allow-list, memory scopes, and execution policy.
- Agent policy includes approval requirements, tool-call limit, and maximum execution duration fields.

Prompt system:
- Prompt registry supports versioned prompt definitions, inheritance, variable declarations, and deterministic rendering.
- Missing variable detection is explicit.
- Prompt render lineage is auditable.

Determinism:
- Prompt construction is deterministic for identical templates and variable sets.
- Inheritance cycles are explicitly guarded.

Assessment result:
- Agent and prompt foundation is strong for initial certification scope.
