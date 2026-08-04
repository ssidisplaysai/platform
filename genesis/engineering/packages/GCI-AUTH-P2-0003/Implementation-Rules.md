# Implementation Rules

Implementation of GCI-P2-0003 must remain deterministic, immutable, and contract-driven.

Required rules:
- deep-freeze all relationship records and snapshots;
- derive stable relationship identities with canonical serialization and SHA-256;
- avoid hidden mutable state;
- preserve source evidence, replay references, and entity linkage;
- create new versions instead of mutating existing records;
- keep registry behavior deterministic and overwrite-by-key only;
- expose only contract-level factory and registry APIs.

Prohibited implementation patterns:
- probabilistic inference or heuristic guessing;
- background orchestration or worker side effects;
- persistence side effects;
- external service calls;
- runtime mutation of upstream records.
