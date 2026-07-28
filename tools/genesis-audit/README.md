# Genesis Audit Tooling - GAR-0001

This tool provides deterministic, additive, non-invasive repository inventory for GAR-0001.

## Placement Rationale

- Tool is placed in `tools/genesis-audit` to follow existing top-level tooling conventions.
- Evidence output is placed in `genesis/audits/GAR-0001` to isolate audit artifacts from runtime code.
- Scanner is read-only for audited source content; it only writes output into the GAR-0001 evidence package.

## Run

```bash
node tools/genesis-audit/src/run.mjs
```

## Guarantees

- Deterministic ordering and stable output hashing.
- Stable path normalization using `/` separators.
- No environment-dependent timestamps in machine-readable output.
- Secret-like value redaction in static findings.
- Repository mutation guard for non-output files.
