# ADR-0014 Institutional Artifact Custody and Placement

## Status

Accepted by Architecture Review Board decision ARD-0002 on 2026-08-27. Repository implementation is not yet published, integrated, or effective on main.

## Context

Genesis recovered institutional artifacts whose source lifecycle labels and directory structure predated durable Git custody. Current governance needed an explicit distinction between repository custody and current authority before the recovered corpus could be considered for integration.

This ADR records the architecture approved with conditions through:

- RAR-0002: `docs/architecture/RAR-0002-genesis-institutional-artifact-custody-placement.md`
- ARD-0002: `docs/architecture/0032-ard-0002-genesis-institutional-artifact-custody-placement.md`

## Decision

1. Canonical custody is distinct from canonical authority. Repository presence grants custody, not authority.
2. Genesis Founder's Office is a non-constitutional founder-intent and historical function.
3. Genesis CEO Office is a non-constitutional executive-intent function.
4. Genesis Experience Studio is a non-constitutional product-experience function.
5. Their proposed repository roots are architecturally approved subject to governance integration.
6. `genesis/philosophy/` may support bounded, non-equivalent artifact classes without placement granting authority.
7. `VISION_PACKAGE` is an approved non-constitutional, non-implementation, non-runtime classification.
8. `GPW-1001`, `GPW-1002`, and `GPW-1003` become `VISION_PACKAGE` only when the approved governance architecture is integrated.
9. `VISION_PACKAGE` is excluded from constitutional package-root parity and does not create a constitutional catalog obligation solely through physical placement.
10. `genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` is navigation-only, non-authoritative, non-constitutional, and non-lifecycle-bearing.
11. `genesis/recovery/GRR-20260810/` is provenance-only, not a registry or promotion record.
12. Historical lifecycle claims do not become current authority through integration and require separate applicable revalidation.
13. Constitutional `GPO-0001` and `GPO-0002` remain protected from Product Office identifier reuse.
14. GMR, GUX, historical Product Office recovery, and unresolved-reference repair remain separately governed.
15. `genesis/experience-studio/GMX-0001/` remains a proposed future target pending governance integration and separate GMX authorization.
16. Governance must become effective before recovery integration.
17. The ten conditions in ARD-0002 govern this decision and may not be bypassed by repository placement.

## Consequences

- Recovered artifacts may later enter durable custody without activating historical certification, freeze, baseline, publication, or promotion claims.
- New institutional functions remain non-constitutional and cannot authorize engineering, runtime, production, releases, or architecture.
- GPW classification and parity treatment become effective only when the governance implementation is approved and integrated.
- Constitutional catalogs and GPO identifiers remain unchanged.
- Documentation, Governance Operations, Engineering Leadership, CODEOWNER, publication, and integration reviews remain pending.
- GMX remains suspended and unmoved.

## Implementation Status

- Architecture decision: ACCEPTED WITH ARD-0002 CONDITIONS
- Governance candidate: LOCAL; NOT PUBLISHED
- Repository implementation: NOT INTEGRATED; NOT EFFECTIVE ON MAIN
- Recovery corpus: SEPARATE
- GMX: SUSPENDED