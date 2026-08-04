# Forbidden Dependencies

The Relationship Runtime must not depend on anything that introduces hidden inference or side effects.

Forbidden dependencies include:
- Business Rule Runtime or policy interpreters;
- Business Genome Assembly Runtime components;
- persistence, database, queue, worker, scheduler, orchestration, or deployment services;
- AI, LLM, heuristic, or probabilistic inference systems;
- OCR, crawler, and unrelated ingestion systems.

The runtime must remain a deterministic, contract-only layer.
