# 10 Workflow and Messaging Integration

## Integration Boundaries

1. Scheduling dispatches commands through Messaging topic publish.
2. Scheduling does not invoke workflow execution methods directly.
3. Workflow-specific scheduling command creation is handled by WorkflowSchedulingAdapter.
4. Workflow instance identifiers are optional metadata on schedule commands.

## Dispatch Flow

1. Evaluate due occurrence.
2. Claim occurrence.
3. Publish scheduling command envelope to messaging topic.
4. Record audit and metrics.

## Boundary Confirmation

1. Workflow remains execution authority.
2. Messaging remains transport authority.
3. Scheduling remains timing eligibility authority.
