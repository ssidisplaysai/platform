# 18 Health Metrics and Audit

Added persistence-aware observability:
- metrics: persistenceWriteCount, persistenceWriteFailureCount, persistenceReadCount, persistenceReadFailureCount, recoveryCount, recoveryFailureCount, schemaRejectionCount, corruptStateRejectionCount, tenantMismatchRecoveryCount, projectionRebuildCount, projectionRebuildFailureCount
- health: persistence-initialization, persistence-schema, persistence-recovery checks
- audit evidence emitted for initialization, first-run empty, recovery started/succeeded/rejected, unsupported schema, read/save failure, and projection rebuild
