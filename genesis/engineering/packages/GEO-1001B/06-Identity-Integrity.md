# 06 Identity Integrity

Implemented controls:
- Duplicate organization ID rejection in runtime registration
- Duplicate organization ID rejection during persisted-state recovery/import
- Duplicate hierarchy node organization identity rejection in persisted-state recovery/import

Fail-closed behavior:
- Invalid duplicate identity states throw and block runtime initialization.
