# Versioning and Compatibility

## Normative Version Domains
A conforming compiler MUST declare:
- compiler version
- specification version
- rule set version(s)
- manifest schema version(s)
- output schema version(s)

## Normative Compatibility Rules
- Backward compatibility behavior MUST be explicitly declared per version.
- Breaking changes SHALL require specification version increment.
- Forward compatibility strategies SHOULD preserve parseability and validation where feasible.

## Normative Cross-Version Replay Rule
Replay MUST use explicit version bindings for compiler, specification, rules, and manifests.
Cross-version replay claims SHALL NOT be considered valid without explicit compatibility declarations.

## Informative Guidance
Semantic versioning conventions MAY be used if they do not weaken normative compatibility constraints.
