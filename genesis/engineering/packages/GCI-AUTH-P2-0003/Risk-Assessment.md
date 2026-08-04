# Risk Assessment

Primary risks:
- scope drift into Rule Runtime or Genome Assembly Runtime;
- hidden heuristic relationship resolution;
- non-deterministic classification, directionality, or cardinality handling;
- mutable records or registry state;
- weak provenance, replay, and entity linkage preservation.

Mitigations:
- narrow contract-only imports;
- explicit boundary documents;
- deterministic serialization and ordering rules;
- immutable records and append-only lifecycle evolution;
- independent certification requirements before integration.
