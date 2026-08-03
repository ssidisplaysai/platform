# Forbidden Dependencies

## Forbidden Runtime Dependencies
- Entity Runtime
- Relationship Runtime
- Business Rule Runtime
- Business Genome Assembly Runtime

## Forbidden Infrastructure Dependencies
- Persistence databases or storage engines
- Scheduling/orchestration systems
- Message queues and worker frameworks
- Deployment tooling as runtime dependency

## Forbidden Capability Dependencies
- AI/LLM inference engines
- OCR engines
- Heuristic or probabilistic reasoning libraries
- Web crawlers and scraping subsystems

## Forbidden Import Rule
Any import that introduces downstream runtime behavior, nondeterminism, hidden mutable state, or infrastructure coupling is prohibited and must fail governance gate review.