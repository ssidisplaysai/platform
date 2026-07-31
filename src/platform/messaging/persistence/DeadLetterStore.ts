import type { DeadLetterEntry } from "../services/DeadLetterService";

export interface DeadLetterStore {
  append(entry: DeadLetterEntry): Promise<void>;
  list(): Promise<DeadLetterEntry[]>;
  depth(): Promise<number>;
}
