# C2 Root Cause: Budget Hard-Limit Enforcement

## Condition
- GAO-1001A C2 identified soft budget assumptions without hard stop semantics.

## Root Cause
- Token/cost tracking existed, but execution did not consistently reject over-budget outcomes.
- Tool and provider phases were not charged against a single execution budget guard.

## Risk
- Overconsumption of model tokens/cost beyond policy intent.
- Inability to prove deterministic financial/resource controls during operations.

## Remediation Strategy
- Add execution budget state with max token and max cost limits.
- Enforce checks pre/post provider generation and during tool-phase accounting.
- Emit budget-exhausted and budget-rejected metrics with failure audit evidence.
