# Genesis Commerce Platform Workflow Profile

## Purpose
Capture reusable workflow configuration references.

## Reference Fields
1. workflowReference
2. providerReference
3. version
4. environmentReference
5. inputContractReference
6. outputContractReference
7. retryPolicyReference
8. executionTimeoutReference

## Guardrails
1. Configuration only.
2. No workflow execution in GCP package scope.
3. Readiness evaluates reference completeness only.
