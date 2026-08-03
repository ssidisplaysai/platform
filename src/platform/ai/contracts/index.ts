export type AIProviderName = "OPENAI" | "ANTHROPIC" | "GEMINI" | "LOCAL_LLM" | "AZURE_OPENAI" | "MOCK";
export type AIModelKind = "CHAT" | "TOOL_CALLING" | "ROUTER" | "EMBEDDING";
export type AIConversationRole = "SYSTEM" | "USER" | "ASSISTANT" | "TOOL";
export type AIMemoryScope = "CONVERSATION" | "SESSION" | "WORKSPACE";
export type AIExecutionStatus = "PLANNED" | "WAITING_FOR_APPROVAL" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
export type AIHealthStatus = "HEALTHY" | "DEGRADED";

export type AIProviderCapability = {
  providerName: AIProviderName;
  supportedModels: string[];
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  maxContextTokens?: number;
  metadata?: Record<string, string>;
};

export type AIProviderAdapterDefinition = {
  providerName: AIProviderName;
  description: string;
  supportedModels: string[];
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  metadata?: Record<string, string>;
};

export type AIProviderRequest = {
  executionId: string;
  modelId: string;
  prompt: string;
  variables: Record<string, string>;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  toolResults: AIToolExecutionResult[];
  context: AIExecutionContext;
};

export type AIProviderResponse = {
  providerName: AIProviderName;
  modelId: string;
  output: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latencyMs: number;
  structuredOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AIProviderHealth = {
  providerName: AIProviderName;
  status: AIHealthStatus;
  detail: string;
  latencyMs?: number;
};

export type AIMessage = {
  role: AIConversationRole;
  content: string;
  createdAt?: string;
  name?: string;
  toolCallId?: string;
  toolName?: string;
};

export type AIModelVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type AIModelDefinition = {
  modelId: string;
  providerName: AIProviderName;
  kind: AIModelKind;
  version: AIModelVersion;
  state: "ACTIVE" | "INACTIVE";
  contextWindowTokens: number;
  maxOutputTokens: number;
  defaultTemperature: number;
  fallbackModelIds: string[];
  supportsStructuredOutput: boolean;
  supportsToolCalls: boolean;
  budget?: {
    maxCostPerExecution?: number;
    maxTokensPerExecution?: number;
  };
  metadata?: Record<string, string>;
};

export type AIExecutionPolicy = {
  allowToolExecution: boolean;
  requireHumanApproval: boolean;
  maxToolCalls: number;
  maxExecutionMs: number;
  fallbackModelIds: string[];
  allowedMemoryScopes: AIMemoryScope[];
};

export type AIAgentDefinition = {
  agentId: string;
  name: string;
  version: AIModelVersion;
  state: "ACTIVE" | "INACTIVE";
  capabilities: string[];
  permissions: string[];
  defaultModelId: string;
  defaultPromptId: string;
  toolAllowList: string[];
  memoryScopes: AIMemoryScope[];
  executionPolicy: AIExecutionPolicy;
  metadata?: Record<string, string>;
};

export type AIPromptDefinition = {
  promptId: string;
  name: string;
  version: AIModelVersion;
  state: "ACTIVE" | "INACTIVE";
  template: string;
  variables: string[];
  inheritsFrom?: string;
  metadata?: Record<string, string>;
};

export type AIPromptRender = {
  promptId: string;
  renderedPrompt: string;
  variables: Record<string, string>;
  lineage: string[];
  renderedAt: string;
};

export type AIToolDefinition = {
  toolId: string;
  name: string;
  version: AIModelVersion;
  state: "ACTIVE" | "INACTIVE";
  permissions: string[];
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  metadata?: Record<string, string>;
};

export type AIToolExecutionRequest = {
  toolId: string;
  input: unknown;
  executionId: string;
  actorId: string;
  tenant: string;
  workspace: string;
  permissions: string[];
  authorizationDecision?: AIAuthorizationDecision;
};

export type AIToolExecutionResult = {
  toolId: string;
  status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  output?: unknown;
  reason?: string;
  retryable: boolean;
  completedAt: string;
};

export type AIExecutionContext = {
  tenant: string;
  workspace: string;
  conversationId: string;
  sessionId: string;
  workspaceMemoryKey?: string;
  locale?: string;
  approvedBy?: string;
  humanApprovalCheckpoint?: boolean;
  cancelSignal?: {
    aborted: boolean;
  };
  metadata?: Record<string, unknown>;
};

export type AIAuthorizationDecision = {
  allowed: boolean;
  reason: string;
  policyId: string;
  cacheHit: boolean;
  evaluatedAt: string;
  provenance: {
    source: "IDENTITY_AUTHORIZATION_SERVICE" | "GENESIS_AUTHORIZATION_RESOLVER";
    principalId: string;
    actionId: string;
    workspaceId?: string;
    requestId: string;
  };
  grantedPermissions: string[];
};

export type AIAuthorizationRequest = {
  principalId: string;
  principalName?: string;
  tenant: string;
  workspace: string;
  agentId: string;
  toolId: string;
  requiredPermissions: string[];
  metadata?: Record<string, unknown>;
};

export type AIExecutionPlan = {
  executionId: string;
  agentId: string;
  modelId: string;
  providerName: AIProviderName;
  promptId: string;
  prompt: string;
  variables: Record<string, string>;
  toolIds: string[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  approvalRequired: boolean;
  routingReason: string;
  fallbackModelIds: string[];
};

export type AIExecutionHistoryEntry = {
  executionId: string;
  status: AIExecutionStatus;
  agentId: string;
  modelId: string;
  providerName: AIProviderName;
  promptId: string;
  startedAt: string;
  completedAt?: string;
  failureReason?: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  toolCount: number;
};

export type AIExecutionResult = {
  executionId: string;
  status: AIExecutionStatus;
  agentId: string;
  modelId: string;
  providerName: AIProviderName;
  promptId: string;
  renderedPrompt: string;
  output: string;
  toolResults: AIToolExecutionResult[];
  startedAt: string;
  completedAt?: string;
  failureReason?: string;
  approvedBy?: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
};

export type AIMetricsSnapshot = {
  executionCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  timedOutCount: number;
  waitingForApprovalCount: number;
  retryCount: number;
  fallbackCount: number;
  toolExecutionCount: number;
  promptRenderCount: number;
  tokenInputCount: number;
  tokenOutputCount: number;
  tokenTotalCount: number;
  costTotal: number;
  averageLatencyMs: number;
  outputValidationFailureCount: number;
  budgetExhaustedCount: number;
  budgetRejectedCount: number;
  authorizationDeniedCount: number;
  authorizationErrorCount: number;
  providerHealth: Partial<Record<AIProviderName, AIHealthStatus>>;
  providerLatencyMs: Partial<Record<AIProviderName, number>>;
  modelUsage: Record<string, number>;
};

export type AIHealthCheckName =
  | "providers"
  | "models"
  | "agents"
  | "prompts"
  | "tools"
  | "memory"
  | "audit"
  | "metrics"
  | "integration";

export type AIHealthSnapshot = {
  status: AIHealthStatus;
  checks: Array<{
    name: AIHealthCheckName;
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  generatedAt: string;
};

export type AIAuditEventType =
  | "EXECUTION_PLANNED"
  | "MODEL_ROUTED"
  | "PROMPT_RENDERED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "TOOL_EXECUTED"
  | "TOOL_REJECTED"
  | "EXECUTION_COMPLETED"
  | "EXECUTION_FAILED"
  | "EXECUTION_CANCELLED"
  | "EXECUTION_TIMED_OUT";

export type AIAuditRecord = {
  recordId: string;
  eventType: AIAuditEventType;
  executionId: string;
  agentId?: string;
  modelId?: string;
  providerName?: AIProviderName;
  promptId?: string;
  toolId?: string;
  tenant: string;
  workspace: string;
  conversationId?: string;
  sessionId?: string;
  actorId?: string;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type AIAuditFailureRecord = {
  failureId: string;
  stage: string;
  retryable: boolean;
  severity: "WARN" | "ERROR";
  message: string;
  executionId: string;
  occurredAt: string;
};

export type AIMemoryRecord = {
  recordId: string;
  scope: AIMemoryScope;
  tenant: string;
  workspace: string;
  conversationId?: string;
  sessionId?: string;
  key: string;
  value: string;
  metadata?: Record<string, string>;
  recordedAt: string;
};

export type AIIntegrationSnapshot = {
  capabilityId: "platform.ai";
  capabilityName: string;
  version: string;
  health: AIHealthSnapshot;
  metrics: AIMetricsSnapshot;
  statistics: {
    providers: number;
    models: number;
    agents: number;
    prompts: number;
    tools: number;
    memoryRecords: number;
    auditRecords: number;
  };
  readiness: {
    providerNeutral: boolean;
    workflowNeutral: boolean;
    schedulingNeutral: boolean;
    messagingNeutral: boolean;
    missionControlCompatible: boolean;
  };
};

export function createDefaultAIMetrics(): AIMetricsSnapshot {
  return {
    executionCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    timedOutCount: 0,
    waitingForApprovalCount: 0,
    retryCount: 0,
    fallbackCount: 0,
    toolExecutionCount: 0,
    promptRenderCount: 0,
    tokenInputCount: 0,
    tokenOutputCount: 0,
    tokenTotalCount: 0,
    costTotal: 0,
    averageLatencyMs: 0,
    outputValidationFailureCount: 0,
    budgetExhaustedCount: 0,
    budgetRejectedCount: 0,
    authorizationDeniedCount: 0,
    authorizationErrorCount: 0,
    providerHealth: {},
    providerLatencyMs: {},
    modelUsage: {},
  };
}
