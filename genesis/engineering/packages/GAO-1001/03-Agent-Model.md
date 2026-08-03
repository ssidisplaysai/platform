# 03 Agent Model

Agent system:
- Agent registry stores metadata, capabilities, versions, permissions, and execution policies.
- Agents declare default prompts, default models, memory scopes, and tool allow-lists.
- Agent policy governs tool execution limits and human approval checkpoints.

Implementation notes:
- Agent definitions are validated before execution.
- Agent permissions gate structured tool execution.
- Agent routing falls back to approved models when needed.
