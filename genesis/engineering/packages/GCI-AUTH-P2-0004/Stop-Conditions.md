# Stop Conditions

Stop work immediately if any of the following occurs:

- a design step introduces Business Genome Assembly Runtime authority
- a design step introduces persistence, scheduling, queues, workers, deployment, infrastructure, or database ownership
- a design step introduces AI, LLM, machine learning, probabilistic reasoning, heuristics, inference, OCR, or crawlers
- a design step introduces runtime mutation or side effects
- a design step requires nondeterministic conflict resolution
- a design step references a forbidden downstream package
- any implementation work begins before independent authorization review is complete

## Recovery Rule
Return to constitutional scope definition and remove the offending dependency or requirement before proceeding.