import { compareDeterministicStrings } from "../../shared/utilities";
import type { OperationLifecycleState, WorkOrderLifecycleState } from "../contracts";
import { ManufacturingDomainError } from "./errors";

type TransitionTable<TState extends string> = Readonly<Record<TState, readonly TState[]>>;

export const workOrderLifecycleTransitions: TransitionTable<WorkOrderLifecycleState> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["RELEASED", "CANCELLED"],
  RELEASED: ["READY", "ON_HOLD"],
  READY: ["IN_PROGRESS", "ON_HOLD"],
  IN_PROGRESS: ["PAUSED", "BLOCKED", "ON_HOLD", "PARTIALLY_COMPLETED", "COMPLETED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "BLOCKED", "ON_HOLD", "CANCELLED"],
  BLOCKED: ["READY", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["READY", "IN_PROGRESS", "CANCELLED"],
  PARTIALLY_COMPLETED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const operationLifecycleTransitions: TransitionTable<OperationLifecycleState> = {
  PENDING: ["READY"],
  READY: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["PAUSED", "BLOCKED", "COMPLETED", "FAILED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  BLOCKED: ["READY", "IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  FAILED: ["READY", "CANCELLED"],
  CANCELLED: ["CLOSED"],
  CLOSED: [],
};

export const workOrderTerminalStates: readonly WorkOrderLifecycleState[] = ["ARCHIVED"];
export const operationTerminalStates: readonly OperationLifecycleState[] = ["CLOSED"];

export function isValidTransition<TState extends string>(table: TransitionTable<TState>, from: TState, to: TState): boolean {
  if (from === to) {
    return true;
  }
  return table[from].includes(to);
}

export function assertValidWorkOrderTransition(from: WorkOrderLifecycleState, to: WorkOrderLifecycleState): void {
  if (!isValidTransition(workOrderLifecycleTransitions, from, to)) {
    throw new ManufacturingDomainError(
      "INVALID_LIFECYCLE_TRANSITION",
      `invalid work order lifecycle transition: ${from} -> ${to}`,
      false,
    );
  }
}

export function assertValidOperationTransition(from: OperationLifecycleState, to: OperationLifecycleState): void {
  if (!isValidTransition(operationLifecycleTransitions, from, to)) {
    throw new ManufacturingDomainError(
      "INVALID_OPERATION_STATE",
      `invalid operation lifecycle transition: ${from} -> ${to}`,
      false,
    );
  }
}

export function isWorkOrderTerminal(state: WorkOrderLifecycleState): boolean {
  return workOrderTerminalStates.includes(state);
}

export function isOperationTerminal(state: OperationLifecycleState): boolean {
  return operationTerminalStates.includes(state);
}

export function canSkipOperation(state: OperationLifecycleState): boolean {
  return state === "READY" || state === "BLOCKED";
}

export function canCompleteOperation(state: OperationLifecycleState): boolean {
  return state === "IN_PROGRESS";
}

export function deterministicWorkOrderTransitions(state: WorkOrderLifecycleState): WorkOrderLifecycleState[] {
  return [...workOrderLifecycleTransitions[state]].sort((left, right) => compareDeterministicStrings(left, right));
}

export function deterministicOperationTransitions(state: OperationLifecycleState): OperationLifecycleState[] {
  return [...operationLifecycleTransitions[state]].sort((left, right) => compareDeterministicStrings(left, right));
}
