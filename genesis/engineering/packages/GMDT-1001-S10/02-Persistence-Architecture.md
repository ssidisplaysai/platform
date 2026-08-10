# 02 Persistence Architecture

Architecture implemented:
- ManufacturingPersistenceCoordinator owns capture, save, load, recovery, and durability wrapping.
- ManufacturingRecoveryCoordinator owns persistence/recovery status and counters.
- ManufacturingFileStore owns file-backed safe read/write mechanics.
- runtime factory initializes persistence after core services and before READY.
- mutation durability is enforced by wrapping top-level command entrypoints and saving canonical state after successful mutation; stateful failure paths with changed state are also persisted.
