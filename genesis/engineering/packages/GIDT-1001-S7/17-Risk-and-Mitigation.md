# 17 Risk and Mitigation

Risks:
- New central validation layer could alter legacy error semantics
- Optional reference behavior could mask integration misconfiguration

Mitigations:
- Preserved INVALID_PRODUCT_REFERENCE behavior for inventory item path
- Added explicit missing-validator audit and metrics counters
- Added focused and regression tests for mandatory/optional outcomes
