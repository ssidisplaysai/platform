# 01 C1 Root Cause

Why rendering was non-deterministic:
1. `TemplateRenderer.render()` injected `renderId: randomUUID()` into the rendered variable payload.
2. The output object therefore changed on every invocation even when the template, variables, tenant, workspace, and locale were identical.
3. `NotificationEngine` passed the rendered object directly to providers and audits, so the non-deterministic field propagated into downstream evidence.
4. No caller-supplied render identity existed, and no deterministic derivation was used.

Runtime randomness source:
- `node:crypto.randomUUID()` inside `TemplateRenderer.ts`.

Impact:
- Identical inputs could not produce byte-for-byte equivalent render output.
- Audit and regression evidence were less reproducible than required for the certification condition.
