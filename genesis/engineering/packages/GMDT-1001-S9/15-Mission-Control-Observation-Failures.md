# 15 Mission Control Observation Failures

Failure behavior:
- Observer publication failures are captured.
- Metrics counter observationPublishFailureCount is incremented.
- Audit event manufacturing.observation.publish.rejected is emitted.
- Domain error classification OBSERVATION_PUBLICATION_FAILURE is raised.
