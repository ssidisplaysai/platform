# 08 Mission Control Observability

Mission Control scope implemented:

1. GET /api/gop/knowledge/health
2. GET /api/gop/knowledge/metrics

Controls:

1. GLW session required.
2. GOP authorization resolver check required.
3. Deterministic deny response with reason code and denied-count metric.
4. No business ownership or runtime decision execution by Mission Control endpoints.

Observability result:

- PASS
