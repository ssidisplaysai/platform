# Genesis Audit Baseline Standard

## Baseline Model
Defines baseline creation, verification, evolution, canonical hashing, version binding, supersession, and historical retention.

## Baseline Rules
1. Baseline creation must define authoritative source and scope boundaries.
2. Baseline verification must use canonical hashing and deterministic inventory ordering.
3. Baseline evolution requires explicit successor baseline disposition.
4. Historical baselines must be retained with lineage records.
5. Baseline handling must remain repository neutral and environment aware.

## Canonical Hashing
Audit baselines shall prefer canonical repository representations over environment-variant working tree encodings.

## Machine Reference
- [machine/baseline-model.json](machine/baseline-model.json)