# 07 Deterministic Serialization

Deterministic controls:
- stable object-key ordering via recursive normalization
- stable collection ordering via deterministic string comparison
- stable idempotency map-entry ordering by key
- repeated serialization of unchanged state is logically stable
- no locale-sensitive sorting
- canonical values preserved without lossy transformation
