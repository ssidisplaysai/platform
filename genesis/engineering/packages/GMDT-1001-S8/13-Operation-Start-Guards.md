# 13 Operation Start Guards

Registration source:
- runtime/factory step 09f

Rules:
- Block start when resource readiness is false (RESOURCE_NOT_READY)
- Block start when active quality hold exists (QUALITY_HOLD_ACTIVE)
