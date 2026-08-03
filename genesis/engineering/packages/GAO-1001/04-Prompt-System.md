# 04 Prompt System

Prompt system:
- Prompt registry stores versioned prompt templates.
- Prompt inheritance is supported through explicit parent linkage.
- Prompt variables are validated before rendering.
- Prompt rendering is deterministic for identical inputs.
- Prompt audit records render activity.

Implementation notes:
- Template variables are collected from the full inheritance chain.
- Rendered prompts preserve stable lineage and reproducible output.
