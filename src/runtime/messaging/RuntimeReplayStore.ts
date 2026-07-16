import type { RuntimeReplayCursor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeReplayStore {
  private readonly cursors = new Map<string, RuntimeReplayCursor>();

  save(cursorId: string, lastSequence: number): RuntimeReplayCursor {
    if (!cursorId || cursorId.trim().length === 0) {
      throw new Error("GRT-MSG-REPLAY-001: cursorId is required");
    }
    if (lastSequence < 0) {
      throw new Error(`GRT-MSG-REPLAY-002: Invalid replay cursor sequence: ${lastSequence}`);
    }
    const cursor = deepFreeze({ cursorId, lastSequence });
    this.cursors.set(cursorId, cursor);
    return cursor;
  }

  get(cursorId: string): RuntimeReplayCursor {
    const cursor = this.cursors.get(cursorId);
    if (!cursor) {
      throw new Error(`GRT-MSG-REPLAY-003: Unknown replay cursor: ${cursorId}`);
    }
    return cursor;
  }

  list(): readonly RuntimeReplayCursor[] {
    return Object.freeze([...this.cursors.values()].sort((a, b) => a.cursorId.localeCompare(b.cursorId)));
  }
}
