# 15 Yield Scrap and Rework Architecture

## Yield

Yield is either:
- a canonical fact where explicitly recorded, or
- a derived projection calculated from approved facts

Prefer derived yield from approved quantities when possible.

Formula guidance:
- numerator: completed output minus approved rejects where policy defines
- denominator: required or planned quantity per approved measurement rule
- denominator zero behavior: reject calculation or return explicit undefined status; do not coerce to zero silently

## Scrap

Scrap is an immutable Manufacturing fact.
- preserves reason codes
- may request Inventory write-off where physical Inventory is affected
- correction behavior uses compensating facts

## Rework

Rework is an immutable Manufacturing fact.
- preserves original execution history
- creates explicit rework linkage
- uses bounded routing re-entry
- never destructively rewrites original output or operation history

Manufacturing does not become Finance cost authority.
