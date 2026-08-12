# Health Engineering Decisions

Work Order: EHC-1001
Date: 2026-07-30

## Decision EHC-D1: EAR as single inventory authority

Decision:
- consume application identities and metadata only through certified EAR interfaces

Rationale:
- prevents inventory duplication
- preserves constitutional ownership boundaries

## Decision EHC-D2: Engine decomposition

Decision:
- isolate capability, evaluation, and aggregation engines from service orchestration

Rationale:
- improves testability and boundary clarity
- supports independent evolution of evaluation logic

## Decision EHC-D3: Metadata-first simulated bootstrapping

Decision:
- generate simulated health records once at runtime boot from EAR application set

Rationale:
- provides initial enterprise health baseline without polling or runtime integration
- satisfies foundation scope constraints

## Decision EHC-D4: Internal API only

Decision:
- expose internal EHC routes without UI implementation

Rationale:
- provides consumption contracts for Mission Control and future services
- prevents premature presentation-layer coupling
