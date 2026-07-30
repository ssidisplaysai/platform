# Genesis Governance Debt Register

## Scope
Governance debt affecting enterprise closeout and Version 1.0 declaration.

## Debt Items
| ID | Governance Debt | Severity | Evidence | V1.0 Impact |
|---|---|---|---|---|
| GD-001 | Constitutional package catalog claims exhaustive local indexing but many indexed identifiers are not present as local directories | High | GEAI catalog vs local directory parity check | Blocks governance completeness claim |
| GD-002 | Decision taxonomy is not normalized across packages (APPROVED, IMPLEMENTED, CERTIFIED, custom labels, missing markers) | High | README marker extraction and package review | Weakens deterministic lifecycle governance |
| GD-003 | Enterprise certification breadth is index-declared but not uniformly auditable in local package roots | High | Genesis-Certification-Index vs local package presence | Blocks enterprise certification closure |
| GD-004 | Branch policy intent exists, but active branch divergence indicates incomplete convergence governance execution | Medium to High | Branch strategy docs plus branch snapshot | Raises risk of governance/runtime drift |
| GD-005 | Release governance tooling path depends on local gh/auth availability | Medium | PR creation blockage context | Adds process friction for protected branch integration |

## Governance Debt Priority Order
1. GD-001 catalog/local parity correction
2. GD-002 lifecycle taxonomy normalization
3. GD-003 certification auditability closure
4. GD-004 branch convergence governance
5. GD-005 release tooling resilience

## Governance Debt Conclusion
Governance debt is the primary blocker class for Version 1.0 declaration.
