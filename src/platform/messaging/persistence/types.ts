import type { MessageMetricsSnapshot } from "../services/MessageMetrics";
import type { DeadLetterEntry } from "../services/DeadLetterService";
import type { MessageAuditRecord } from "../services/AuditWriter";
import type { DeliveryMode, MessageEnvelope } from "../contracts";

export type PendingMessageRecord = {
  topic: string;
  mode: DeliveryMode;
  enqueuedAt: string;
  envelope: MessageEnvelope;
};

export type RetryRecord = {
  messageId: string;
  topic: string;
  subscriptionId: string;
  subscriberName: string;
  attempt: number;
  retriedAt: string;
  reason: string;
};

export type RecoverySnapshot = {
  pendingMessages: PendingMessageRecord[];
  retryRecords: RetryRecord[];
  deadLetters: DeadLetterEntry[];
  auditRecords: MessageAuditRecord[];
  metrics: MessageMetricsSnapshot | null;
};
