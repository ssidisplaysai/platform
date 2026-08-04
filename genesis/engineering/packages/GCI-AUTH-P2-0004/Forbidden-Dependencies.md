# Forbidden Dependencies

The Business Rule Runtime authorization must not depend on anything downstream or anything that would expand the runtime into orchestration or genome assembly.

## Forbidden Dependency Classes
- Business Genome Assembly Runtime
- genome compilation services
- persistence layers
- scheduling systems
- queues and workers
- deployment automation
- infrastructure control planes
- database ownership layers
- message buses
- workflow engines
- AI, LLM, and machine learning services
- probabilistic reasoning engines
- heuristic decision systems
- inference services
- OCR systems
- crawlers
- any runtime mutation path
- any side-effectful integration path

## Forbidden Package Direction
Any package that sits downstream of Business Rule Runtime is forbidden as a dependency for this authorization package.