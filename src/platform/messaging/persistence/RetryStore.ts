import type { RetryRecord } from "./types";

export interface RetryStore {
  append(record: RetryRecord): Promise<void>;
  clearByMessage(messageId: string): Promise<void>;
  list(): Promise<RetryRecord[]>;
  depth(): Promise<number>;
}
