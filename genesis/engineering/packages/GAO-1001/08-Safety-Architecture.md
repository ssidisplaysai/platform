# 08 Safety Architecture

Safety architecture:
- Tool permission checks are enforced before execution.
- Prompt validation prevents missing or malformed prompt variables.
- Output validation and structured execution are represented in the model and tool layers.
- Human approval checkpoints are supported by execution policy.
- Safety policy is surfaced through audit, metrics, and health.

Implementation notes:
- The foundation is designed to fail closed on missing permissions or missing required prompt data.
