# 06 Execution Architecture

Execution architecture:
- Execution planning selects a model and provider based on policy and registry state.
- Execution context preserves tenant, workspace, conversation, and session boundaries.
- Execution history captures status, token usage, cost, and tool count.
- Retry, timeout, cancellation, and compensation hooks are represented in the foundation.

Implementation notes:
- The engine coordinates prompts, tools, memory, and provider calls.
- Execution state is observable and auditable.
