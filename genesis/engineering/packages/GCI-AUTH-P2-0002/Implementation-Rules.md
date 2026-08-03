# Implementation Rules

Implementation of GCI-P2-0002 must remain deterministic, immutable, and contract-driven.

Required rules:
- deep-freeze all entity records and snapshots;
- derive stable identities with canonical serialization and SHA-256;
- avoid hidden mutable state;
- preserve source observation references;
- create new versions instead of mutating existing records;
- keep registry behavior deterministic and overwrite-by-key only;
- expose only contract-level factory and registry APIs.

Prohibited implementation patterns:
- probabilistic inference;
- background orchestration;
- persistence side effects;
- external service calls;
- runtime mutation of upstream records.