# 14 Corrupt State Handling

Corrupted JSON, malformed manifests, unsupported schema versions, and invalid persisted shapes are all rejected.

Slice 9 does not silently coerce or repair persisted Inventory state.