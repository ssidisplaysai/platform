# 00 Manifest

Package: GWF-1001B Genesis Workflow Platform Production Hardening

Branch: feature/gwf-1001-workflow-foundation
Baseline commit: 194820f
Package intent: Close all GWF-1001A conditions C1-C4 through hardening only.

Included source areas:
- src/platform/workflow/contracts
- src/platform/workflow/services
- src/platform/workflow/persistence
- src/platform/workflow/index.ts
- tests/workflow
- tests/gop/mission-control-workflow.test.ts

Non-goals:
- No capability expansion beyond GWF-1001
- No external API version changes
- No certification authority decision in this package

Evidence mapping:
- C1: 03-Persistence-Architecture.md, 04-Recovery-Model.md
- C2: 05-Concurrency-and-Idempotency.md
- C3: 06-Negative-Path-Test-Report.md
- C4: 07-Observability-Report.md, 08-Compatibility-Report.md, 09-Operational-Readiness.md