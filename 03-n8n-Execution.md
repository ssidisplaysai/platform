# 03 n8n Execution Evidence

Job ID: glw_1dg1hax8

## Receipt Confirmation
- Execution ID: 46992
- Evidence points:
  - GLW job result.executionId = 46992
  - GLW job externalExecutionId = 46992
  - GOP job events correlationId/workflowExecutionId include 46992

## Execution URL
- n8n webhook origin configured: https://ssiai.app.n8n.cloud
- Execution URL (inferred by standard n8n pattern): https://ssiai.app.n8n.cloud/execution/46992
- Note: explicit execution URL was not returned by GLW APIs for this run.

## Workflow Runtime State
Source: GET /api/gop/jobs/glw_1dg1hax8/execution
- Execution record id: gexec_glw_glw_1dg1hax8
- Status: DISPATCHED
- Current node: n_intake
- Node completed: 0 of 5
- Queue wait ms: 116

## Node Execution Summary
- n_intake (VALIDATION) dependsOn: none
- n_generate_content (AI) dependsOn: n_intake
- n_generate_image (IMAGE_GENERATION) dependsOn: n_generate_content
- n_publish (WORDPRESS) dependsOn: n_generate_image
- n_notify (NOTIFICATION) dependsOn: n_publish

## Success/Failure Path
- Success path reached: NO
- Failure path reached: NO
- Terminal workflow result: NOT REACHED DURING OBSERVATION WINDOW
