# Genesis Technical Debt Register

## Scope
Technical debt that materially impacts Version 1.0 readiness.

## Debt Items
| ID | Debt Item | Severity | Evidence | V1.0 Impact |
|---|---|---|---|---|
| TD-001 | High branch divergence vs main across active feature streams | High | Branch ahead/behind analysis snapshot | Raises integration and regression risk |
| TD-002 | Inconsistent package metadata coverage (missing README and decision markers in many roots) | Medium | Local package scan | Obscures true implementation/certification state |
| TD-003 | Partial local materialization of indexed package families | Medium | Catalog/local parity check | Limits end-to-end technical auditability |
| TD-004 | PR automation dependency on local tooling/auth (gh unavailable) | Low to Medium | PR execution attempt context | Slows governed release execution |
| TD-005 | Evidence generation outputs are large and fragmented across files | Low | GAR evidence collection experience | Slows repeated audit cycles |

## Net Technical Debt Position
- Current position: Moderate-to-high technical debt for enterprise release integration.
- Most urgent technical debt: branch convergence and package metadata normalization.

## Exit Criteria for V1.0
1. Critical branches converged through governed PR flow.
2. Package metadata complete and machine-auditable across all local roots.
3. Core release automation path available in governed environment.
