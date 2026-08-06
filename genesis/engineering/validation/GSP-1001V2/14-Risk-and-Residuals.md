# 14 Risk and Residuals

Blocking risks:

- NONE identified.

Residual non-blocking risks:

1. Locale-specific string ordering portability
- Some deterministic ordering relies on localeCompare behavior.
- Current behavior is acceptable for present consumer scope.

2. JSON normalization type loss outside supported contract
- normalizeJson remains intentionally JSON-contract scoped.
- Caller responsibility remains explicitly documented.

3. Future consumer-specific policy expansion risk
- Shared framework remains mechanical and bounded.
- Future consumers must preserve fail-closed and read-only policy boundaries.

Residual risk disposition:

- ACCEPTED as non-blocking for shared revalidation closure and certification readiness.