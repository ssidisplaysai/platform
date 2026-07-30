import type { AuditEventRecord, NotificationRecord } from "./types";

export const FOUNDATION_NOTIFICATIONS: readonly NotificationRecord[] = [];

export const FOUNDATION_AUDIT_EVENTS: readonly AuditEventRecord[] = [];

export function getNotificationEmptyStateMessage(): string {
  return "No notifications yet. System and organization events will appear here.";
}

export function getAuditEmptyStateMessage(): string {
  return "No audit events yet. Governance activity will populate this stream.";
}
