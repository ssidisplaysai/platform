import type { NotificationState } from "../contracts";

const ALLOWED_TRANSITIONS: Record<NotificationState, NotificationState[]> = {
  REQUESTED: ["VALIDATED", "SUPPRESSED", "FAILED"],
  VALIDATED: ["SUPPRESSED", "DEFERRED", "QUEUED", "FAILED"],
  SUPPRESSED: ["CANCELLED"],
  DEFERRED: ["QUEUED", "CANCELLED", "FAILED"],
  QUEUED: ["DELIVERING", "CANCELLED", "FAILED"],
  DELIVERING: ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "DEAD_LETTERED"],
  DELIVERED: [],
  PARTIALLY_DELIVERED: ["DEAD_LETTERED", "DELIVERED", "FAILED"],
  FAILED: ["QUEUED", "DEAD_LETTERED", "CANCELLED"],
  DEAD_LETTERED: ["QUEUED", "CANCELLED"],
  CANCELLED: [],
};

export class Lifecycle {
  canTransition(from: NotificationState, to: NotificationState): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  }

  requireTransition(from: NotificationState, to: NotificationState): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`invalid lifecycle transition ${from} -> ${to}`);
    }
  }
}
