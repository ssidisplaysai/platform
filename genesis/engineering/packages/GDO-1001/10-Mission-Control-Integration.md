# 10 Mission Control Integration

Mission Control observability routes:

- src/app/api/gop/documents/health/route.ts
- src/app/api/gop/documents/metrics/route.ts

Boundary conformance:

- Mission Control usage is observability-only.
- Explicit authorization checks gate route access.
- No Mission Control ownership or workflow execution ownership is introduced.
