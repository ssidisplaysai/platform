export interface ObjectLifecycle {
  currentState: string;
  allowedTransitions?: ObjectLifecycleTransition[];
}

export interface ObjectLifecycleTransition {
  from: string;
  to: string;
  event?: string;
  requiresPermission?: string;
}
