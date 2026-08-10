# 16 Reference Recovery

Reference recovery policy implemented:
- structural local reference integrity is validated from persisted Manufacturing records
- live foreign authority repair is not attempted during recovery
- mandatory validator availability is checked through the existing Slice 9 reference health policy
- missing mandatory validator blocks recovery
- optional validator unavailability degrades health rather than mutating foreign state
