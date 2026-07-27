# GBA-0007 Renewal Framework

## Renewal Record

1. Contract reference and expiry timestamp.
2. Renewal probability percent.
3. Renewal forecast value.
4. Churn risk percent.
5. Escalation required flag.
6. Recommendation summary.

## Risk Rules

1. Renewal is flagged at-risk when probability < 70.
2. Renewal is flagged at-risk when churn risk > 30.
3. Agent health renewalsAtRisk count is computed from these conditions.

## Recommendation Linkage

1. Renewal risk drives RENEWAL category recommendations.
2. Review decisions are persisted and reflected in recommendation status.
