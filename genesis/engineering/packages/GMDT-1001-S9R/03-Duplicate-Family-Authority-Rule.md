# 03 Duplicate Family Authority Rule

Authority rule implemented:
- Each external reference family has one deterministic authoritative validator registration.
- First authoritative registration for a family succeeds.
- Second authoritative registration for the same family rejects with classification DUPLICATE_REFERENCE_VALIDATOR.
- Existing registration remains intact and is not overwritten.
- Duplicate attempts are not silently ignored.

Architecture alignment:
- External integrations now declare explicit externalReferenceFamilies authority lists.
- Distinct integrations can own distinct families concurrently.
