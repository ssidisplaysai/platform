# Genesis Commerce Consumer Guide

## Consumer Responsibilities
Consumers shall:
1. Validate contract version compatibility.
2. Validate payload schema before processing.
3. Honor idempotency and duplicate-delivery safety.
4. Preserve audit records for consumed events and command/query interactions.
5. Ignore unknown future fields when backward compatible.
6. Preserve correlation and causation metadata end-to-end.

## Consumer Prohibitions
Consumers shall not:
1. Directly read Commerce persistence.
2. Mutate Commerce aggregates outside command contracts.
3. Depend on internal Commerce implementation details.

## Consumer Validation Checklist
1. Envelope complete and valid.
2. Version acceptable.
3. Security context complete.
4. Organization scope valid.
5. Idempotency key processed safely.
6. Errors classified for retry or dead-letter.

## Consumer Replay Checklist
1. Preserve original envelope identifiers.
2. Preserve correlation and causation chain.
3. Use deterministic idempotency checks.
4. Persist replay audit metadata.
