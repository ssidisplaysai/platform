# Allowed Dependencies

This authorization depends on a deterministic runtime dependency ladder. The dependency meaning is expressed by layer, not by package identifier.

## Dependency Ladder
Runtime Foundation
↓
Evidence Runtime
↓
Evidence Validation Runtime
↓
Manifest Runtime
↓
Replay Runtime
↓
IBR Runtime
↓
Entity Runtime
↓
Relationship Runtime
↓
Business Rule Runtime

## Dependency Rule
Business Rule Runtime is the only newly authorized semantic runtime in this ladder. Business Genome Assembly Runtime remains explicitly forbidden.

No dependency may introduce genome assembly, persistence, scheduling, queues, workers, deployment, infrastructure, database ownership, message buses, workflow execution, AI, LLMs, machine learning, probabilistic reasoning, heuristics, inference, OCR, crawlers, or runtime mutation.