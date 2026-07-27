# GEA-0003 Replay

Replay verifies deterministic reproducibility for a saved context package.

## Behavior
- Input: contextPackageId
- Output: replayChecksum, deterministicPossible, deterministicMatch, reason
- Record persisted as GeaContextReplay

## Semantics
- deterministicPossible=false when package is missing.
- deterministicMatch=true when reconstructed canonical checksum equals package checksum.
- Any mismatch is reported with reason metadata.
