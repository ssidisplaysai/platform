# Risk Assessment

Primary risks:
- scope drift into Relationship, Rule, or Genome Assembly runtimes;
- hidden heuristic identity resolution;
- non-deterministic alias or duplicate handling;
- mutable records or registry state;
- weak provenance preservation for supporting and contradicting observations.

Mitigations:
- narrow contract-only imports;
- explicit boundary documents;
- deterministic serialization and ordering rules;
- immutable records and append-only lifecycle evolution;
- independent certification requirements before integration.