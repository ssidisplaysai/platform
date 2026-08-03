# Runtime Architecture

## Runtime Stack
Compiler Runtime Foundation

↓

Evidence Runtime

↓

Evidence Validation Runtime

↓

Manifest Runtime

↓

Replay Runtime

## Dependency Direction
The runtime stack dependency direction is one-way and preserved:
- Foundation provides immutable deterministic host primitives.
- Each downstream runtime depends only on approved upstream runtime contracts.
- Reverse coupling is constitutionally disallowed.

## Permanent Substrate Record
This stack is the permanent runtime substrate of Genesis Compiler. Future phases extend the stack under governance control and do not redesign foundational architecture.