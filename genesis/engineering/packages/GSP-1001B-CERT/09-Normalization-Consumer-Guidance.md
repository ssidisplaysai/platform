# 09 Normalization Consumer Guidance

Purpose:

- Define bounded operational usage constraints for shared normalization helpers.

Scope:

- Applies to src/platform/shared/utilities/normalization.ts helpers.
- Guidance is operational for shared consumers and does not create a constitutional standard.

Intended use cases:

1. Canonicalizing case-insensitive identifiers (normalizeIdentifier).
2. Collapsing presentation-insensitive whitespace (normalizeWhitespace).
3. Producing deterministic JSON-native payload clones for persistence/interchange contracts (normalizeJson).

Supported JSON-native value categories for normalizeJson:

1. string
2. number (finite JSON-serializable)
3. boolean
4. null
5. arrays composed of supported values
6. plain objects composed of supported values

Unsupported or bounded behaviors:

1. Date: serialized to ISO string (lossy type conversion).
2. bigint: unsupported, serialization throws.
3. function: omitted in object properties; array entries become null.
4. symbol: omitted in object properties; array entries become null.
5. undefined: omitted in object properties; array entries become null.
6. Map: serialized as empty plain object unless transformed by caller.
7. Set: serialized as empty plain object unless transformed by caller.
8. circular references: unsupported, serialization throws.
9. class instances: prototype behavior lost; only enumerable JSON data retained.
10. binary data objects (for example Buffer/typed arrays): transformed to JSON representation that may not preserve intended binary semantics.

Prohibited use cases:

1. Preserving domain semantics for unsupported or non-JSON-native values.
2. Security-significant serialization without domain-specific canonicalization.
3. Schema evolution or migration repair logic.
4. Persisting values that require lossless type fidelity across process boundaries.

Caller responsibilities:

1. Validate input domain constraints before normalization.
2. Reject unsupported values before persistence when lossless behavior is required.
3. Apply domain-specific serializers where type fidelity matters.

Platform invariant responsibilities:

1. Enforce domain invariants after normalization.
2. Ensure normalized payloads still satisfy platform schema and business rules.
3. Prevent normalization helpers from becoming authority for domain meaning.

Persistence safety limitations:

1. normalizeJson is bounded to JSON-compatible semantics only.
2. It does not guarantee round-trip preservation for unsupported runtime types.

Mandatory statement:

- Shared normalization is not a universal serializer.
- It must not be used to preserve domain semantics for unsupported or non-JSON-native values.

When to use a domain-specific serializer instead:

1. Domain includes Date/time types requiring type-preserving round-trip.
2. Domain includes bigint, binary payloads, Map/Set semantics, or class-instance identity.
3. Domain requires canonical, signed, or cryptographically stable serialization.