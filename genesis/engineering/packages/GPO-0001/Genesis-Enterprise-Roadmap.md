# Genesis Enterprise Roadmap

## Roadmap Principles
1. Every program must be deterministic and versioned.
2. Dependencies must be explicit and acyclic.
3. Certification status must be visible alongside scope.
4. Production status must be separated from authorization status.

## Program Inventory
| Program | Current State | Dependencies | Certification Status | Production Status |
|---|---|---|---|---|
| Constitution | Established | None | Complete | Baseline only |
| Governance | Established | Constitution | Complete | Baseline only |
| Release Management | Established | Governance | Complete | v0.1.0 certified |
| Business Genome | Certified baseline | Governance, Release Management | WS-I certified | No runtime authorization beyond WS-I |
| Commerce | Authorized architecture baseline | Governance, Business Genome | Certified by prior baselines | Production baseline present |
| Manufacturing | Authorized architecture and implementation baseline | Governance, Commerce | Partially certified by package family | Production baseline present |
| Marketing | Planned constitutional program | Governance, Commerce, Business Genome | Not yet authorized | Not yet authorized |
| Identity | Constitutional foundation | Governance | Certified baseline | Production baseline present |
| Security | Constitutional foundation | Governance, Identity | Certified baseline | Production baseline present |
| Runtime | Not authorized beyond current baseline | Governance, Security | Not authorized | Not authorized |
| Analytics | Planned constitutional program | Governance, Business Genome, Commerce | Not yet authorized | Not yet authorized |
| AI | Not authorized beyond governance baseline | Governance, Security, Identity | Not yet authorized | Not yet authorized |
| Operations | Authorized governance and release support | Governance, Release Management, Security | Certified baseline | Production baseline present |

## Roadmap Summary
The roadmap tracks constitutional programs only. Implementation work may begin only after the relevant governance and certification gates are satisfied.