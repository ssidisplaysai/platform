# Genesis Merge Recommendations

## Objective
Provide governed merge recommendations for integrating readiness-critical work into main.

## Current Merge Context
- Many feature branches are not merged into main.
- Several branches are materially behind main, increasing merge conflict and regression risk.
- Protected-branch governance pattern requires PR-based integration.

## Recommendations
1. Establish a release-convergence branch for GAR-0003 governance closure.
2. Prioritize merge order by dependency chain and certification impact:
- Governance/index normalization streams
- Certification evidence normalization streams
- Domain implementation streams
3. Require branch-level pre-merge checks:
- Clean diff check
- Genesis doctor healthy
- Genesis self validate valid
- Package metadata gate pass
4. Enforce one-way convergence:
- Rebase/merge from main before PR approval
- Block stale branches beyond agreed behind threshold
5. Publish merge completion ledger:
- Branch, PR, decision, approver, timestamp, post-merge validation state

## Recommended Merge Priority Cohorts
- Cohort 1: Governance integrity branches
- Cohort 2: Certification and package metadata normalization branches
- Cohort 3: Domain completion branches
- Cohort 4: Non-critical experimental/discovery branches

## Merge Recommendation Verdict
Merge readiness is conditional and requires a governance-led convergence sequence before Version 1.0 declaration.
