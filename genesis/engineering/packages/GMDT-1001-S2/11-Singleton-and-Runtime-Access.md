# 11 Singleton and Runtime Access

Implemented APIs:
- initializeManufacturingRuntime
- getManufacturingRuntime
- resetManufacturingRuntimeForTests

Behavior:
- Explicit initialization only.
- Duplicate initialization rejects.
- Failed initialization does not poison singleton state.
- Clean retry after failure is supported.
- Reset/dispose behavior supports test isolation.
