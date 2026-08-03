# Forbidden Dependencies

The Entity Runtime must not depend on anything that introduces hidden inference or side effects.

Forbidden dependencies include:
- relationship resolution or relationship runtime layers;
- rule engines or policy interpreters;
- genome assembly components;
- persistence, database orchestration, queueing, worker, or scheduler services;
- deployment or workflow engines;
- AI, LLM, heuristic, or probabilistic inference systems;
- crawlers, OCR, or ingestion pipelines unrelated to approved upstream contracts.

The runtime must remain a deterministic, contract-only layer.