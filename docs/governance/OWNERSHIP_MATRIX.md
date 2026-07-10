# Ownership Matrix

## Ownership Model

This matrix defines primary ownership. Replace placeholder teams with actual org teams.

| Subsystem | Primary Owner | Supporting Owners | Notes |
| --- | --- | --- | --- |
| Architecture Governance | @genesis-architecture-review-board | @genesis-engineering-lead | RAR/ARD/ADR authority |
| Compiler Platform | @genesis-compiler-platform | @genesis-testing | Pass manager, gates, diagnostics |
| Discovery | @genesis-compiler-platform | @genesis-docs | Discovery ingestion and provenance intake |
| Evidence IR | @genesis-canonical-model | @genesis-compiler-platform | Epistemic boundary ownership |
| Business Genome Model | @genesis-canonical-model | @genesis-architecture-review-board | Canonical semantics ownership |
| Enterprise Blueprint IR | @genesis-compiler-platform | @genesis-canonical-model | Downstream architecture contract |
| Runtime Platform | @genesis-runtime | @genesis-security | Runtime orchestration ownership |
| Mission Control | @genesis-modules | @genesis-runtime | Application-level operating surfaces |
| SDK | @genesis-sdk | @genesis-compiler-platform | Developer extension surface |
| Documentation | @genesis-docs | All subsystem owners | Canonical docs and onboarding |
| Developer Tooling | @genesis-build | @genesis-compiler-platform | CLI, automation, local workflows |
| Testing | @genesis-testing | All subsystem owners | Test strategy and gate ownership |
| CI/CD | @genesis-build | @genesis-testing | Quality gates and pipeline health |
| Security And Trust | @genesis-security | @genesis-architecture-review-board | Security policy and review |
| Governance Operations | @genesis-governance | @genesis-engineering-lead | Repository policy and controls |

## Responsibility Rules

1. Every critical path change requires primary owner review.
2. Cross-subsystem changes require at least one supporting owner review.
3. Ownership disputes escalate to Engineering Leadership.
