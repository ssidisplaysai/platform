export const genesisJobTypes = [
  "PAGE_GENERATION",
  "BLOG_GENERATION",
  "PRODUCT_GENERATION",
  "IMAGE_GENERATION",
  "MEDIA_GENERATION",
  "DOCUMENT_INGESTION",
  "BUSINESS_GENOME_COMPILATION",
  "PLUGIN_EXECUTION",
  "AI_AGENT",
  "SYSTEM",
  "CUSTOM",
] as const;

export type GenesisJobType = (typeof genesisJobTypes)[number];

export const genesisPlatformRoles = [
  "VIEWER",
  "OPERATOR",
  "MANAGER",
  "ADMINISTRATOR",
  "DEVELOPER",
  "SYSTEM",
] as const;

export type GenesisPlatformRole = (typeof genesisPlatformRoles)[number];

export const genesisJobStatuses = [
  "QUEUED",
  "STARTING",
  "RUNNING",
  "GENERATING_CONTENT",
  "GENERATING_IMAGE",
  "UPLOADING_IMAGE",
  "VALIDATION_STARTED",
  "VALIDATION_PASSED",
  "PUBLISHING",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "ARCHIVED",
] as const;

export type GenesisJobStatus = (typeof genesisJobStatuses)[number];

export type GenesisJobPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const genesisExecutionStatuses = [
  "CREATED",
  "SCHEDULED",
  "QUEUED",
  "DISPATCHED",
  "RUNNING",
  "WAITING",
  "BLOCKED",
  "RETRYING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "ARCHIVED",
] as const;

export type GenesisExecutionStatus = (typeof genesisExecutionStatuses)[number];

export type GenesisExecutionClass = "INTERACTIVE" | "AUTOMATED" | "SCHEDULED" | "SYSTEM";

export const genesisExecutionNodeTypes = [
  "AI",
  "PLUGIN",
  "WORDPRESS",
  "DATABASE",
  "VALIDATION",
  "IMAGE_GENERATION",
  "EMAIL",
  "NOTIFICATION",
  "HUMAN_APPROVAL",
  "CUSTOM",
] as const;

export type GenesisExecutionNodeType = (typeof genesisExecutionNodeTypes)[number];

export type GenesisJobError = {
  message: string;
  step?: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type GenesisExecutionContext = {
  requestId?: string;
  traceId?: string;
  correlationId?: string;
  actorId?: string;
  actorName?: string;
  applicationId?: string;
  moduleId?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisWorker = {
  workerId: string;
  name: string;
  kind?: string;
  pool?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
};

export type GenesisWorkerHealth = "HEALTHY" | "DEGRADED" | "OFFLINE";

export type GenesisWorkerRegistration = {
  workerId: string;
  name: string;
  workerType: string;
  capabilities: string[];
  maxCapacity: number;
  currentWorkload: number;
  heartbeatAt: string;
  health: GenesisWorkerHealth;
  protocolVersion?: string;
  supportedProtocolVersions?: string[];
  instanceId?: string;
  environment?: string;
  tokenId?: string;
  authMode?: "SESSION" | "SIGNED_TOKEN" | "MTLS";
  leaseTtlMs?: number;
  heartbeatIntervalMs?: number;
  lastLeaseId?: string | null;
  disconnectedAt?: string | null;
  workspaceId?: string;
  moduleId?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisExecutionNode = {
  nodeId: string;
  label: string;
  nodeType: GenesisExecutionNodeType;
  dependsOn: string[];
  timeoutMs?: number;
  retryLimit?: number;
  metadata?: Record<string, unknown>;
};

export type GenesisExecutionEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  condition?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisExecutionGraph = {
  graphId: string;
  nodes: GenesisExecutionNode[];
  edges: GenesisExecutionEdge[];
};

export type GenesisExecutionRetryEntry = {
  attempt: number;
  reason: string;
  occurredAt: string;
};

export type GenesisExecutionTiming = {
  createdAt: string;
  scheduledAt?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  archivedAt?: string;
};

export type GenesisExecutionMetrics = {
  durationMs?: number;
  queueWaitMs?: number;
  retries: number;
  nodeCompleted: number;
  nodeTotal: number;
};

export type GenesisExecution = {
  executionId: string;
  executionType?: string;
  workspaceId: string;
  moduleId: string;
  jobType: GenesisJobType;
  jobId?: string;
  executionClass: GenesisExecutionClass;
  status: GenesisExecutionStatus;
  currentState?: string;
  priority: GenesisJobPriority;
  queueName?: string;
  context: GenesisExecutionContext;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  artifacts: GenesisArtifact[];
  worker?: GenesisWorkerRegistration | null;
  correlationId?: string;
  causationId?: string;
  parentExecutionId?: string | null;
  childExecutionIds: string[];
  retryHistory: GenesisExecutionRetryEntry[];
  timing: GenesisExecutionTiming;
  scheduledAt?: string;
  timeoutMs?: number;
  metrics: GenesisExecutionMetrics;
  graph: GenesisExecutionGraph;
  currentNodeId?: string;
  blockedReason?: string;
  approvalRequired?: boolean;
  executionVersion?: number;
  snapshotVersion?: number;
  archivedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type GenesisExecutionSnapshot = {
  snapshotId: string;
  executionId: string;
  snapshotVersion: number;
  snapshotSequence: number;
  status: GenesisExecutionStatus;
  currentState?: string;
  currentNodeId?: string;
  progressPercent: number;
  queuePosition?: number | null;
  worker?: GenesisWorkerRegistration | null;
  retryCount: number;
  retryHistory: GenesisExecutionRetryEntry[];
  output?: Record<string, unknown> | null;
  timing: GenesisExecutionTiming;
  metrics: GenesisExecutionMetrics;
  artifacts: GenesisArtifact[];
  state: GenesisExecution;
  upToEventSequence?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GenesisQueueState = "ACTIVE" | "PAUSED" | "DRAINING";

export type GenesisQueuePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type GenesisLeaseState = "ACTIVE" | "RELEASED" | "EXPIRED" | "STOLEN";

export type GenesisDispatchOutcome = "COMPLETED" | "FAILED" | "RETRY" | "ABANDONED";

export type GenesisQueueItem = {
  queueItemId: string;
  executionId: string;
  workspaceId: string;
  moduleId: string;
  workerType: string;
  executionClass: GenesisExecutionClass;
  priority: GenesisQueuePriority;
  enqueuedAt: string;
  scheduledFor?: string;
  queueName?: string;
  requiredCapabilities?: string[];
  affinityWorkerId?: string;
  attempts?: number;
  maxAttempts?: number;
  deadLetterOnFailure?: boolean;
  metadata?: Record<string, unknown>;
};

export type GenesisExecutionLease = {
  leaseId: string;
  executionId: string;
  queueItemId: string;
  workerId: string;
  workspaceId: string;
  moduleId: string;
  leaseStartAt: string;
  leaseExpiresAt: string;
  heartbeatDeadlineAt: string;
  renewalCount: number;
  leaseState: GenesisLeaseState;
  protocolVersion: string;
  tokenId?: string;
  stolenFromWorkerId?: string | null;
  releasedAt?: string | null;
  releaseReason?: string | null;
  metadata?: Record<string, unknown>;
};

export type GenesisDeadLetterEntry = {
  deadLetterId: string;
  executionId: string;
  queueItemId: string;
  workspaceId: string;
  moduleId: string;
  queueName?: string;
  reason: string;
  retryHistory: GenesisExecutionRetryEntry[];
  failureHistory: Array<{
    occurredAt: string;
    reason: string;
    details?: Record<string, unknown>;
  }>;
  operatorNotes?: string;
  archivedAt?: string | null;
  recoveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GenesisQueueMetrics = {
  queued: number;
  leased: number;
  retryQueued: number;
  deadLettered: number;
  expiredLeases: number;
  dispatchLatencyMsP50: number;
  dispatchLatencyMsP95: number;
  queueWaitMsP50: number;
  queueWaitMsP95: number;
  leaseUtilizationPercent: number;
};

export type GenesisWorkerUtilization = {
  workerId: string;
  workerType: string;
  utilizationPercent: number;
  idleMs: number;
  activeLeases: number;
  lastHeartbeatAt: string;
};

export type GenesisRuntimeFabricMetrics = {
  dispatchLatencyMsP50: number;
  dispatchLatencyMsP95: number;
  leaseAcquisitionMsP50: number;
  leaseAcquisitionMsP95: number;
  queueWaitMsP50: number;
  queueWaitMsP95: number;
  workerUtilization: GenesisWorkerUtilization[];
  workerIdleMsP95: number;
  retryFrequencyPerMinute: number;
  deadLetterRatePerMinute: number;
  throughputPerMinute: number;
};

export type GenesisNotificationChannel = "IN_APP" | "EMAIL" | "WEBHOOK" | "TEAMS" | "SLACK";

export type GenesisPlatformNotification = GenesisNotification & {
  channel: GenesisNotificationChannel;
  source:
    | "EXECUTION_COMPLETED"
    | "EXECUTION_FAILED"
    | "WORKER_OFFLINE"
    | "QUEUE_BLOCKED"
    | "APPROVAL_REQUIRED"
    | "TIMEOUT"
    | "RETRY_EXHAUSTED";
  workspaceId?: string;
  executionId?: string;
};

export type GenesisHealthStatus = "HEALTHY" | "DEGRADED" | "CRITICAL";

export type GenesisHealthSnapshot = {
  status: GenesisHealthStatus;
  workerHeartbeatLagMs: number;
  queueLatencyMs: number;
  executionLatencyMs: number;
  databaseHealthy: boolean;
  eventThroughputPerMinute: number;
  callbackLatencyMs: number;
  apiFailureRate: number;
  updatedAt: string;
};

export type GenesisOperationsSnapshot = {
  generatedAt: string;
  workspaceId: string;
  executions: GenesisExecution[];
  queue: {
    state: GenesisQueueState;
    depth: number;
    activeByPriority: Record<GenesisQueuePriority, number>;
    paused: boolean;
    retryDepth?: number;
    deadLetterDepth?: number;
    leasedDepth?: number;
    expiredLeases?: number;
  };
  workers: GenesisWorkerRegistration[];
  leases?: GenesisExecutionLease[];
  deadLetters?: GenesisDeadLetterEntry[];
  workerUtilization?: GenesisWorkerUtilization[];
  fabricMetrics?: GenesisRuntimeFabricMetrics;
  alerts: GenesisPlatformNotification[];
  notifications: GenesisPlatformNotification[];
  failedExecutions: GenesisExecution[];
  retryQueue: GenesisExecution[];
  activeApprovals: GenesisExecution[];
  throughputPerMinute: number;
  runningJobs: number;
  health: GenesisHealthSnapshot;
  metrics: GenesisMetric[];
};

export type GenesisArtifact = {
  artifactId: string;
  type: string;
  name: string;
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GenesisNotification = {
  notificationId: string;
  title: string;
  message: string;
  kind?: "info" | "success" | "warning" | "error";
  audience?: string;
  readAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type GenesisMetric = {
  metricId: string;
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisActionKind = "primary" | "secondary" | "destructive" | "link" | "menu";

export type GenesisAction = {
  actionId: string;
  label: string;
  kind?: GenesisActionKind;
  href?: string;
  disabled?: boolean;
  tooltip?: string;
  confirmMessage?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisPermission = {
  permissionId: string;
  label: string;
  description?: string;
};

export type GenesisWorkspaceMembership = {
  workspaceId: string;
  actorId: string;
  role: GenesisPlatformRole;
  permissions: string[];
  active: boolean;
};

export type GenesisPolicy = {
  policyId: string;
  description: string;
  effect: "allow" | "deny";
  roles?: GenesisPlatformRole[];
  permissions?: string[];
  workspaceIds?: string[];
  moduleIds?: string[];
  jobTypes?: GenesisJobType[];
  jobStatuses?: GenesisJobStatus[];
  actions?: string[];
  extensionIds?: string[];
};

export type GenesisResourceReference = {
  workspaceId?: string;
  moduleId?: string;
  route?: string;
  jobId?: string;
  jobType?: GenesisJobType;
  jobStatus?: GenesisJobStatus;
  extensionId?: string;
  ownerActorId?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisActionReference = {
  actionId: string;
  type:
    | "module_visibility"
    | "route_access"
    | "job_visibility"
    | "job_action"
    | "inspector_extension"
    | "metrics_access"
    | "admin_control"
    | "notification_access"
    | "workspace_access";
};

export type GenesisAuthorizationSubject = {
  actorId: string;
  actorName?: string;
  role: GenesisPlatformRole;
  workspaceMemberships: GenesisWorkspaceMembership[];
  permissions: string[];
};

export type GenesisAuthenticatedIdentity = {
  actorId: string;
  actorName?: string;
  email: string;
  expiresAt: number;
};

export type GenesisAuthorizationRequest = {
  subject: GenesisAuthorizationSubject;
  workspaceId?: string;
  moduleId?: string;
  route?: string;
  jobType?: GenesisJobType;
  jobStatus?: GenesisJobStatus;
  action: GenesisActionReference;
  resource: GenesisResourceReference;
};

export type GenesisAuthorizationDecision = {
  allowed: boolean;
  denied: boolean;
  reasonCode:
    | "ALLOWED"
    | "DENIED_ROLE"
    | "DENIED_WORKSPACE"
    | "DENIED_MODULE"
    | "DENIED_ACTION"
    | "DENIED_ROUTE"
    | "DENIED_STATE"
    | "DENIED_EXTENSION"
    | "DENIED_OWNERSHIP"
    | "DENIED_POLICY"
    | "DENIED_DEFAULT";
  reason: string;
  policyId: string;
  subject: GenesisAuthorizationSubject;
  resource: GenesisResourceReference;
  action: GenesisActionReference;
};

export type GenesisJobEvent = {
  eventId: string;
  jobId: string;
  moduleId: string;
  jobType: GenesisJobType;
  type: string;
  label: string;
  stage?: string;
  status?: GenesisJobStatus;
  message?: string;
  source?: string;
  occurredAt: string;
  sequence: number;
  durationMs?: number;
  actorId?: string;
  actorName?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  actor?: string;
  worker?: GenesisWorker;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type GenesisTimelineState = "pending" | "active" | "complete" | "failed" | "cancelled" | "archived";

export type GenesisTimelineEntry = {
  timelineId: string;
  eventId?: string;
  label: string;
  state: GenesisTimelineState;
  occurredAt?: string;
  description?: string;
  duration?: string;
  metadata?: Record<string, unknown>;
};

export type GenesisInspectorSection = {
  sectionId: string;
  title: string;
  description?: string;
  order?: number;
  content?: unknown;
};

export type GenesisInspector = {
  inspectorId: string;
  title: string;
  summary?: string;
  sections: GenesisInspectorSection[];
  actions?: GenesisAction[];
  artifacts?: GenesisArtifact[];
  notifications?: GenesisNotification[];
  metadata?: Record<string, unknown>;
};

export type GenesisJob<TType extends GenesisJobType = GenesisJobType, TInput = unknown, TResult = unknown> = {
  jobId: string;
  type: TType;
  applicationId: string;
  moduleId: string;
  status: GenesisJobStatus;
  priority: GenesisJobPriority;
  input: TInput;
  result: TResult | null;
  error: GenesisJobError | null;
  events: GenesisJobEvent[];
  artifacts: GenesisArtifact[];
  notifications: GenesisNotification[];
  worker?: GenesisWorker | null;
  context?: GenesisExecutionContext;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
  archivedAt?: string | null;
};

export type GenesisNavigationItem = {
  label: string;
  href: string;
  icon?: string;
  enabled?: boolean;
  order?: number;
  permission?: string;
  badge?: string;
  badgeTone?: "neutral" | "success" | "warning" | "danger" | "accent";
};

export type GenesisModuleRoute = {
  label: string;
  href: string;
  description?: string;
  permission?: string;
};

export type GenesisModulePermission = {
  permissionId: string;
  label: string;
  description?: string;
  scope?: string;
};

export type GenesisModuleIcon = {
  name: string;
  glyph?: string;
  uri?: string;
};

export type GenesisModuleManifest = {
  moduleId: string;
  name: string;
  description?: string;
  enabled?: boolean;
  order?: number;
  navigation: GenesisNavigationItem[];
  routes: GenesisModuleRoute[];
  permissions: GenesisModulePermission[];
  supportedJobTypes: GenesisJobType[];
  actions?: GenesisAction[];
  icons?: GenesisModuleIcon[];
  badges?: GenesisNotification[];
  metrics?: GenesisMetric[];
  metadata?: Record<string, unknown>;
};

export type GenesisWorkspaceDescriptor = {
  workspaceId: string;
  name: string;
  description?: string;
  enabled: boolean;
  defaultModuleId?: string;
  enabledModuleIds: string[];
  availableSites?: Array<{ siteId: string; name: string; region?: string }>;
  featureFlags?: string[];
  branding?: {
    shortName?: string;
    accentColor?: string;
    logoText?: string;
  };
  environment?: string;
  order?: number;
};

export type GenesisWorkspaceIdentity = {
  workspaceId: string;
  workspaceKey: string;
  displayName: string;
  aliases?: string[];
  registration: {
    defaultModuleId: string;
    enabledModuleIds: string[];
    featureFlags?: string[];
    environment?: string;
    order?: number;
  };
};

export type GenesisApplicationJobType = "PAGE_GENERATION" | "BLOG_GENERATION";

export type GenesisApplicationJobStatus =
  | "QUEUED"
  | "STARTING"
  | "RUNNING"
  | "GENERATING_CONTENT"
  | "GENERATING_IMAGE"
  | "UPLOADING_IMAGE"
  | "PUBLISHING"
  | "COMPLETE"
  | "FAILED";

export type GenesisApplicationPageJobInput = {
  type: "page_generation";
  site: {
    id: string;
    name: string;
  };
  page: {
    title: string;
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    wordCount: number;
    tone: string;
    audience: string;
    callToAction: string;
    category: string;
    status: "draft" | "publish";
  };
  promptData: {
    tone: string;
    audience: string;
    callToAction: string;
  };
  seoSettings: {
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    category: string;
  };
  publishingSettings: {
    status: "draft" | "publish";
    wordCount: number;
  };
  imageSettings: {
    generateFeaturedImage: boolean;
    style: string;
  };
  callbackUrl?: string;
};

export type GenesisApplicationJobError = {
  message: string;
  step?: string;
  code?: string;
};

export type GenesisApplicationJobResult = {
  executionId: string;
  status: GenesisApplicationJobStatus;
  title?: string;
  wordpressPageId?: string | number;
  wordpressUrl?: string;
  wordpressPostId?: string | number;
  featuredImageUrl?: string;
  executionTimeMs?: number;
};

export type GenesisApplicationJobRecord = {
  id: string;
  type: GenesisApplicationJobType;
  status: GenesisApplicationJobStatus;
  retryOfJobId: string | null;
  siteId: string;
  title: string;
  input: GenesisApplicationPageJobInput;
  result: GenesisApplicationJobResult | null;
  error: GenesisApplicationJobError | null;
  externalExecutionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
