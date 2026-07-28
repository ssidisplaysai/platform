# Genesis Audit Quality Assurance Standard

## Mandatory QA Requirements
- Coverage verification
- Schema validation
- Cross-reference validation
- Machine-readable validation
- Human-readable validation
- Completeness checks

## QA Rules
1. Required output set must be complete before audit closure.
2. Machine-readable outputs must parse and validate against schemas.
3. Human-readable outputs must include all mandatory sections.
4. Cross-references must resolve.
5. QA failures block audit completion.

## Machine Reference
- [machine/validation-registry.schema.json](machine/validation-registry.schema.json)