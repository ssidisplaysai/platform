export type NotificationId = string;
export type NotificationRequestId = string;
export type TemplateId = string;

export type NotificationType = "SYSTEM" | "SECURITY" | "BILLING" | "OPERATIONS" | "PRODUCT";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type NotificationState =
  | "REQUESTED"
  | "VALIDATED"
  | "SUPPRESSED"
  | "DEFERRED"
  | "QUEUED"
  | "DELIVERING"
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "FAILED"
  | "DEAD_LETTERED"
  | "CANCELLED";

export type NotificationChannel = "EMAIL" | "SMS" | "PUSH" | "WEBHOOK" | "IN_APP";

export type RecipientReference = {
  recipientId: string;
  kind: "EXPLICIT" | "IDENTITY" | "WORKSPACE";
  tenant: string;
  workspace: string;
  actorId?: string;
  email?: string;
  phoneNumber?: string;
  pushToken?: string;
  webhookUrl?: string;
  attributes?: Record<string, string>;
};

export type ResolvedRecipient = {
  recipientId: string;
  tenant: string;
  workspace: string;
  actorId?: string;
  channels: Partial<Record<NotificationChannel, string>>;
  preferredLocale?: string;
};

export type RecipientResolutionResult = {
  resolved: ResolvedRecipient[];
  unresolved: Array<{
    reference: RecipientReference;
    reason: "NOT_FOUND" | "OUT_OF_BOUNDARY" | "MISSING_CHANNEL";
  }>;
};

export type ChannelPreference = {
  enabledChannels?: NotificationChannel[];
  disabledChannels?: NotificationChannel[];
  preferredOrder?: NotificationChannel[];
};

export type QuietHoursPolicy = {
  enabled: boolean;
  timezone: string;
  startHour: number;
  endHour: number;
  allowCritical: boolean;
};

export type SuppressionRule = {
  suppressionId: string;
  scope: "TENANT" | "WORKSPACE" | "RECIPIENT" | "CHANNEL" | "NOTIFICATION_TYPE";
  tenant: string;
  workspace?: string;
  recipientId?: string;
  channel?: NotificationChannel;
  notificationType?: NotificationType;
  reason: string;
  active: boolean;
  expiresAt?: string;
};

export type TemplateVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type TemplateDefinition = {
  templateId: TemplateId;
  channel: NotificationChannel;
  version: TemplateVersion;
  state: "ACTIVE" | "INACTIVE";
  locale?: string;
  requiredVariables: string[];
  subjectTemplate?: string;
  titleTemplate?: string;
  bodyTemplate: string;
  metadata?: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDefinition = {
  notificationId: NotificationId;
  notificationType: NotificationType;
  version: TemplateVersion;
  state: "ACTIVE" | "INACTIVE";
  name: string;
  description?: string;
  allowedChannels: NotificationChannel[];
  templateByChannel: Partial<Record<NotificationChannel, TemplateId>>;
  defaultPriority: NotificationPriority;
  retryPolicy: RetryPolicy;
  metadata?: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRequest = {
  requestId: NotificationRequestId;
  idempotencyKey: string;
  notificationId: NotificationId;
  tenant: string;
  workspace: string;
  actorId: string;
  recipients: RecipientReference[];
  payload: Record<string, string | number | boolean | null>;
  priority?: NotificationPriority;
  requestedAt: string;
  correlationId: string;
  causationId: string;
  workflowInstanceId?: string;
  scheduleAt?: string;
  expiresAt?: string;
};

export type RenderedNotification = {
  templateId: TemplateId;
  templateVersion: TemplateVersion;
  channel: NotificationChannel;
  subject?: string;
  title?: string;
  body: string;
  variables: Record<string, string>;
};

export type DeliveryStatus = "QUEUED" | "DELIVERED" | "FAILED" | "DEFERRED" | "DEAD_LETTERED";

export type DeliveryResult = {
  status: DeliveryStatus;
  providerName: string;
  channel: NotificationChannel;
  externalId?: string;
  retryable: boolean;
  reason?: string;
  deliveredAt?: string;
};

export type DeliveryAttempt = {
  attemptId: string;
  requestId: NotificationRequestId;
  recipientId: string;
  channel: NotificationChannel;
  providerName: string;
  attemptNumber: number;
  dedupeKey: string;
  correlationId: string;
  causationId: string;
  createdAt: string;
  completedAt?: string;
  result?: DeliveryResult;
};

export type RetryPolicy = {
  maxAttempts: number;
  retryDelaySeconds: number;
  backoffMultiplier?: number;
  retryableReasons?: string[];
};

export type DeadLetterRecord = {
  deadLetterId: string;
  requestId: NotificationRequestId;
  reason: string;
  finalAttemptNumber: number;
  createdAt: string;
  recoverable: boolean;
  metadata?: Record<string, string>;
};

export type NotificationAuditRecord = {
  recordId: string;
  requestId?: NotificationRequestId;
  notificationId?: NotificationId;
  eventType:
    | "REQUEST_RECEIVED"
    | "REQUEST_VALIDATED"
    | "RECIPIENT_RESOLVED"
    | "RECIPIENT_UNRESOLVED"
    | "TEMPLATE_RESOLVED"
    | "RENDER_COMPLETED"
    | "SUPPRESSED"
    | "DEFERRED"
    | "CHANNEL_SELECTED"
    | "DELIVERY_ATTEMPT_CREATED"
    | "DELIVERY_SUCCEEDED"
    | "DELIVERY_FAILED"
    | "RETRY_SCHEDULED"
    | "RETRY_EXHAUSTED"
    | "DEAD_LETTER_CREATED"
    | "RECOVERY_PERFORMED"
    | "CORRUPT_STATE_DETECTED"
    | "AUDIT_FAILURE";
  actorId: string;
  tenant: string;
  workspace: string;
  correlationId?: string;
  causationId?: string;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type NotificationMetrics = {
  registeredNotificationDefinitions: number;
  registeredTemplates: number;
  requestedNotifications: number;
  suppressedNotifications: number;
  deferredNotifications: number;
  queuedNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  deadLetteredNotifications: number;
  deliveryAttempts: number;
  retryCount: number;
  duplicateRequestCount: number;
  preferenceRejections: number;
  quietHourDeferrals: number;
  providerFailures: number;
  auditFailures: number;
  recoveryCount: number;
  activeQueuedNotifications: number;
  activeDeferredNotifications: number;
  oldestPendingNotificationAgeMs: number | null;
  averageDeliveryLatencyMs: number;
  deliverySuccessRateByChannel: Partial<Record<NotificationChannel, number>>;
};

export type NotificationHealth = {
  status: "HEALTHY" | "DEGRADED";
  checks: Array<{
    name:
      | "registry"
      | "templates"
      | "recipientResolution"
      | "preferencePolicy"
      | "suppression"
      | "providers"
      | "persistence"
      | "retry"
      | "deadLetter"
      | "audit"
      | "recovery"
      | "configuration";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  generatedAt: string;
};

export type NotificationSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type NotificationError = {
  code:
    | "NOTIFICATION_INVALID_REQUEST"
    | "NOTIFICATION_UNKNOWN_DEFINITION"
    | "NOTIFICATION_UNKNOWN_TEMPLATE"
    | "NOTIFICATION_MISSING_TEMPLATE_VARIABLE"
    | "NOTIFICATION_RECIPIENT_UNRESOLVED"
    | "NOTIFICATION_NO_ELIGIBLE_CHANNEL"
    | "NOTIFICATION_SUPPRESSED"
    | "NOTIFICATION_PROVIDER_UNAVAILABLE"
    | "NOTIFICATION_PROVIDER_REJECTED"
    | "NOTIFICATION_DELIVERY_TIMEOUT"
    | "NOTIFICATION_RETRY_EXHAUSTED"
    | "NOTIFICATION_DUPLICATE_REQUEST"
    | "NOTIFICATION_INVALID_LIFECYCLE_TRANSITION"
    | "NOTIFICATION_PERSISTENCE_FAILURE"
    | "NOTIFICATION_RECOVERY_FAILURE"
    | "NOTIFICATION_AUDIT_FAILURE"
    | "NOTIFICATION_CORRUPT_STATE";
  message: string;
  retryable: boolean;
  auditRequired: boolean;
  severity: NotificationSeverity;
};

export type ProviderCapability = {
  providerName: string;
  supportedChannels: NotificationChannel[];
  maxPayloadBytes?: number;
  supportsHtml?: boolean;
  supportsUnicode?: boolean;
};

export type NotificationProcessingResult = {
  requestId: NotificationRequestId;
  state: NotificationState;
  deliveredCount: number;
  failedCount: number;
  suppressed: boolean;
  deferred: boolean;
  duplicate: boolean;
};
