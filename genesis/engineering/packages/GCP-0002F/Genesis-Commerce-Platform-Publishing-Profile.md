# Genesis Commerce Platform Publishing Profile

## Purpose
Compose publishing dependencies through profile references rather than implementation detail duplication.

## Required References
1. wordpressProfileReference
2. workflowProfileReference
3. promptProfileReference
4. seoProfileReference
5. imageProfileReference (recommended)
6. analyticsProfileReference (recommended)

## Guardrails
1. Publishing profile does not execute publication.
2. Linked profile existence/readiness is validated through bounded readiness checks.
3. No external publishing API interaction occurs in this package.
