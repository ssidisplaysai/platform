# Genesis Commerce Producer Guide

## Producer Responsibilities
Commerce shall:
1. Publish complete event envelopes.
2. Never mutate published payloads.
3. Version all contracts.
4. Publish deterministic identifiers.
5. Preserve correlation and causation metadata.
6. Emit deterministic idempotency keys.

## Producer Validation Checklist
1. Contract version set.
2. Aggregate identity and version set.
3. Actor and organization context set.
4. Correlation and causation set.
5. Payload and metadata immutable at publish boundary.
6. Idempotency key deterministic and unique to semantic fact.

## Producer Compatibility Duties
1. Maintain backward compatibility within major versions.
2. Publish migration guidance before breaking changes.
3. Run parallel major versions during migration windows.
4. Preserve governance traceability for contract evolution decisions.

## Producer Security Duties
1. Publish explicit identity and authorization context.
2. Never depend on hidden authorization assumptions.
3. Preserve audit metadata for every publication.
