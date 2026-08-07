# 15 Production Output Yield Scrap Rework Model

## ProductionOutputRecord

Captures:
- completed units
- rejected units
- scrap outcomes
- rework outcomes
- byproduct where approved
- finished goods and intermediate or WIP output

Required fields:
- outputId
- workOrderReference
- operationReference
- productReference
- quantity
- disposition
- inventoryReceiptRequestReference
- timestamp
- idempotencyKey
- version
- traceability linkage

## Yield, Scrap, Rework

YieldRecord:
- calculated using defined inputs from output and defect facts
- records calculation basis and formula version

ScrapRecord:
- canonical scrap fact with reason codes
- immutable history; correction by compensating record

ReworkRecord:
- canonical rework initiation and completion facts
- links source output and target operation

## Fact and Metric Rules

- canonical facts are immutable and append-only
- derived metrics must reference underlying fact identities
- no destructive rewrite of output, scrap, or rework history
- correction model uses compensating records
- Manufacturing does not assume Finance cost-accounting authority
