/**
 * RuntimeStatus.ts
 *
 * Runtime status model with validated, deterministic state transitions.
 *
 * The Enterprise Runtime progresses through these states exactly once,
 * in the sequence defined by VALID_TRANSITIONS. Transitions that deviate
 * from the declared model are rejected at runtime.
 */

/**
 * All valid runtime states.
 */
export type RuntimeStatus =
  | "created"
  | "preparing"
  | "executing"
  | "verifying"
  | "certifying"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Terminal states from which no further transition is allowed.
 */
export type TerminalStatus = "completed" | "failed" | "cancelled";

/**
 * Active states during which execution is ongoing.
 */
export type ActiveStatus = "preparing" | "executing" | "verifying" | "certifying";

/**
 * Valid state transition map.
 * Every possible transition is explicitly declared. Any transition not
 * present is invalid and must be rejected.
 */
const VALID_TRANSITIONS: ReadonlyMap<RuntimeStatus, readonly RuntimeStatus[]> = new Map([
  ["created",    ["preparing", "cancelled"]],
  ["preparing",  ["executing", "failed", "cancelled"]],
  ["executing",  ["verifying", "failed", "cancelled"]],
  ["verifying",  ["certifying", "completed", "failed", "cancelled"]],
  ["certifying", ["completed", "failed", "cancelled"]],
  ["completed",  []],
  ["failed",     []],
  ["cancelled",  []],
]);

/**
 * Returns true if the transition from → to is valid.
 */
export const isValidTransition = (from: RuntimeStatus, to: RuntimeStatus): boolean => {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && (allowed as readonly RuntimeStatus[]).includes(to);
};

/**
 * Returns true if status is a terminal state (no further transitions).
 */
export const isTerminal = (status: RuntimeStatus): status is TerminalStatus =>
  status === "completed" || status === "failed" || status === "cancelled";

/**
 * Returns true if status represents active execution.
 */
export const isActive = (status: RuntimeStatus): status is ActiveStatus =>
  status === "preparing" ||
  status === "executing" ||
  status === "verifying" ||
  status === "certifying";

/**
 * Asserts that a status transition is valid, throwing if not.
 */
export const assertValidTransition = (from: RuntimeStatus, to: RuntimeStatus): void => {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid runtime status transition: "${from}" → "${to}". ` +
      `Allowed transitions from "${from}": [${(VALID_TRANSITIONS.get(from) ?? []).join(", ")}]`,
    );
  }
};
