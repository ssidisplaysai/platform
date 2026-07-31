import type { PendingMessageRecord } from "./types";

export interface MessageStore {
  enqueue(record: PendingMessageRecord): Promise<void>;
  remove(messageId: string): Promise<void>;
  listPending(): Promise<PendingMessageRecord[]>;
  oldestPendingTimestamp(): Promise<string | null>;
}
