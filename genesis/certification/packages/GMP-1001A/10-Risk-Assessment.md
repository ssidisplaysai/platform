# Risk Assessment

## Risk Register

1. In-memory durability
- Severity: High
- Likelihood: High
- Impact: Message loss on process termination
- Evidence: InMemoryTransport, DeadLetterService, AuditWriter, and metrics are memory-backed only
- Mitigation: Add durable transport and durable audit/dead-letter persistence in a future work order
- Certification Effect: Condition

2. Multi-node deployment
- Severity: High
- Likelihood: Medium
- Impact: Cross-node delivery inconsistency and isolated in-memory buses
- Evidence: Only InMemoryTransport is implemented
- Mitigation: Introduce shared transport abstraction implementation for multi-node deployment
- Certification Effect: Condition

3. Retry loss on restart
- Severity: Medium
- Likelihood: High
- Impact: In-flight retries disappear after restart
- Evidence: Retry state exists only inside DeliveryPipeline execution flow
- Mitigation: Durable retry queue/state in a future transport
- Certification Effect: Condition

4. Dead-letter loss on restart
- Severity: Medium
- Likelihood: High
- Impact: Operational evidence loss
- Evidence: DeadLetterService stores entries in process memory
- Mitigation: Durable dead-letter store in future transport/persistence layer
- Certification Effect: Condition

5. Duplicate delivery
- Severity: Medium
- Likelihood: Medium
- Impact: Consumers may process duplicates when duplicateDetector is not supplied
- Evidence: Duplicate detection is a hook, not a default enforced mechanism
- Mitigation: Consumer idempotency strategy and future durable delivery semantics
- Certification Effect: Non-blocking

6. Ordering assumptions
- Severity: Medium
- Likelihood: Medium
- Impact: Consumers may assume stronger ordering guarantees than documented
- Evidence: orderingKey exists in metadata but no scheduler or partitioning enforcement exists
- Mitigation: Explicit delivery-order contract in future transport work
- Certification Effect: Non-blocking

7. Unbounded queue growth
- Severity: Medium
- Likelihood: Medium
- Impact: Memory pressure under heavy workload
- Evidence: No bounded queue or backpressure control in InMemoryTransport
- Mitigation: Queue controls and durable broker semantics in future transport
- Certification Effect: Condition

8. Subscriber failure isolation
- Severity: Medium
- Likelihood: Medium
- Impact: Serial delivery can delay later subscribers
- Evidence: DeliveryPipeline processes subscriptions sequentially
- Mitigation: Future concurrency/isolation design if needed by scope
- Certification Effect: Non-blocking

9. Poison-message handling
- Severity: Medium
- Likelihood: Medium
- Impact: Repeated failures until dead-letter threshold reached
- Evidence: Bounded retry exists; no richer poison-message taxonomy exists
- Mitigation: Future failure classification and operator tooling
- Certification Effect: Non-blocking

10. Payload size
- Severity: Medium
- Likelihood: Medium
- Impact: Memory pressure and slower delivery
- Evidence: No payload-size enforcement in contracts or validation
- Mitigation: Future payload governance and transport limits
- Certification Effect: Non-blocking

11. Sensitive payload content
- Severity: High
- Likelihood: Medium
- Impact: Sensitive data may be retained in memory-backed dead-letter/audit structures
- Evidence: Generic payload contract does not sanitize or redact content
- Mitigation: Data-handling standards and future persistence controls
- Certification Effect: Condition

12. Operational observability
- Severity: Medium
- Likelihood: Medium
- Impact: Limited historical diagnosis
- Evidence: Metrics and health are snapshot-based; no durable historical store exists
- Mitigation: Future persistent telemetry and audit integration
- Certification Effect: Condition

## Risk Conclusion

The dominant risks are operational durability and production-scale behavior, not core foundation correctness.