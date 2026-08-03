# 05 Tool System

Tool system:
- Tool registry stores tool contracts, permissions, and execution handlers.
- Tool discovery is registry-based and provider-neutral.
- Tool execution is permission-checked before invocation.
- Tool audit records execution and rejection outcomes.
- Tool metrics are captured through the orchestration runtime.

Implementation notes:
- Tools are executed as structured operations, not as ad hoc callbacks.
- Unauthorized tools are blocked deterministically.
