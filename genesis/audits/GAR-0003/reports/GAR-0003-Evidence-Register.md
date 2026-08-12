# GAR-0003 Evidence Register

## GAR3-EVD-001
- Type: artifact-existence
- Source: filesystem-scan
- Path: genesis/governance/**
- Verification: VERIFIED
- Summary: Required governance authority artifacts present: 14/14
- Hash: 16264394565c05052b415d59683702a69dd0742f09f696919b38f8285d83520f

## GAR3-EVD-002
- Type: cross-reference-validation
- Source: markdown-link-scan
- Path: genesis/governance/**/*.md
- Verification: VERIFIED
- Summary: Governance markdown missing links: 0
- Hash: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945

## GAR3-EVD-003
- Type: machine-parse-validation
- Source: json-parse-scan
- Path: genesis/governance/**/*.json
- Verification: VERIFIED
- Summary: Parsed governance JSON files: 51; failures: 0
- Hash: 6fd5a37da8a44ea2e1498e91f276414c5a4840d4d63203644ce8b95aa97db2f0

## GAR3-EVD-004
- Type: authority-acyclic-validation
- Source: graph-cycle-check
- Path: genesis/governance/machine/authority-graph.json
- Verification: VERIFIED
- Summary: Governance authority cycle detected: false
- Hash: 4586f4ddf203fa41a535b3b83b97e5c48c8025cb1994a66a52a980564e89d8c8

## GAR3-EVD-005
- Type: baseline-integrity-validation
- Source: hash-recompute
- Path: genesis/governance/baselines/ggb-0001/machine/baseline-integrity.json
- Verification: VERIFIED
- Summary: Baseline integrity mismatches: 0
- Hash: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945

## GAR3-EVD-006
- Type: release-traceability-check
- Source: release-machine-review
- Path: genesis/governance/releases/ggr-0001/machine/release-manifest.json
- Verification: VERIFIED
- Summary: Release manifest commit field is null; registry commit field is null
- Hash: 305d3f14d1112a29a20375fb1b1570cf964ed930f7c89a540e35a822048c02de

## GAR3-EVD-007
- Type: git-release-state
- Source: git-metadata
- Path: .git
- Verification: VERIFIED
- Summary: HEAD da84dac on feature/gar-0003-constitutional-assessment; governance tag present: true; tag commit matches head: true
- Hash: d0e3c1a3d51b777d7bb04515d554b98589fce6210e06d32891778404d4314ace


