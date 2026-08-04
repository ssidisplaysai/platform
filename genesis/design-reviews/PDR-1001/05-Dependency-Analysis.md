# 05 Dependency Analysis

Required dependencies (consumer-only):

- Identity/Authentication/Authorization for governed access decisions
- Organization for ownership context and audience scope
- Contact for contributor/reviewer attribution
- Document for source and publication references
- Workflow for review and approval progression
- Messaging/Notification for distribution events

Optional dependencies (consumer-only):

- Scheduling for timed publication and review windows
- Asset for linked evidence or media references
- AI Orchestration for summarization, recommendation, and planning support
- Mission Control integration for observability

Forbidden dependencies:

- Any dependency that grants Knowledge ownership of another platform's core domain
- Direct dependency on implementation internals of other platforms
- Any dependency that makes Mission Control or AI owners of knowledge-domain behavior

Dependency direction:

- Knowledge consumes certified upstream contracts.
- Upstream platforms do not depend on Knowledge for their core ownership semantics.

Circular dependency analysis:

- No circular dependency is required by the proposed model.
- Circular relationships are prohibited by constitutional rule.
