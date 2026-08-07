# 29 Risk and Complexity

| Risk | Likelihood | Impact | Mitigation | Evidence Required | Certification Implication |
|---|---|---|---|---|---|
| Work Order lifecycle complexity | Medium | High | strict lifecycle tables and command gating | lifecycle tests and audit traces | critical readiness gate |
| routing graph complexity | Medium | High | acyclic validation and bounded rework edges | cycle-prevention evidence | blocking if cycles allowed |
| rework-loop complexity | Medium | Medium | explicit rework graph semantics | rework trace evidence | readiness dependency |
| Product/BOM version drift | High | High | execution baseline freeze and version snapshots | BOM lineage evidence | blocking if not traceable |
| material requirement derivation risk | Medium | High | deterministic derivation from approved BOM | requirement derivation evidence | blocking if incoherent |
| Inventory integration risk | Medium | High | bounded contracts and fail-closed behavior | negative-path integration evidence | major readiness factor |
| cross-platform atomicity risk | Medium | High | aggregate-local atomicity plus compensating facts | orchestration evidence | blocks if hidden partial commit |
| consumption reconciliation risk | Medium | High | issue/consume separation and variance tracking | reconciliation evidence | readiness factor |
| output reconciliation risk | Medium | High | explicit receipt/trace finalization rules | output receipt evidence | readiness factor |
| WIP drift | Medium | Medium | recomputable WIP projection | WIP rebuild evidence | operational risk |
| resource assignment races | Medium | High | optimistic concurrency and capacity checks | race-condition evidence | readiness factor |
| labor concurrency | Medium | Medium | role, shift, and assignment versioning | assignment evidence | operational risk |
| traceability integrity | Low | High | append-only trace records and recovery validation | trace integrity evidence | blocking if corruptible |
| persistence growth | Medium | Medium | snapshotting and history partitioning | growth and replay evidence | manageable with strategy |
| recovery complexity | Medium | High | deterministic recovery sequence and block-on-corruption | restart evidence | readiness factor |
| validator availability | Medium | High | fail-closed mandatory validator registry | readiness evidence | blocking if unavailable |
| Mission Control observability | Low | Medium | read-only observation contract | telemetry evidence | non-blocking if degraded |
| GIDT-CERT-C001 evidence interaction | Medium | Medium | document future validator family surface | interface evidence | future integration consideration |

Overall risk posture:
- high complexity but implementation-ready with clear boundaries and fail-closed rules
