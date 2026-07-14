/**
 * RuntimeEventBus.ts
 *
 * Deterministic publish/subscribe event bus for runtime events.
 *
 * Properties:
 * - No external messaging or network calls.
 * - Subscribers are called synchronously in registration order.
 * - Events are stored in a persistent history log.
 * - Sequence numbers are monotonically increasing within a run.
 */

import type { AnyRuntimeEvent, RuntimeEventType } from "./RuntimeEvents.js";

export type RuntimeEventHandler<T extends AnyRuntimeEvent = AnyRuntimeEvent> = (event: T) => void;

/**
 * Deterministic publish/subscribe event bus.
 */
export interface RuntimeEventBus {
  /**
   * Subscribe to a specific event type.
   * Handlers are called synchronously in registration order.
   */
  readonly subscribe: <T extends AnyRuntimeEvent>(
    type: RuntimeEventType,
    handler: RuntimeEventHandler<T>,
  ) => void;

  /**
   * Subscribe to every event type.
   */
  readonly subscribeAll: (handler: RuntimeEventHandler) => void;

  /**
   * Publish an event.
   * All matching subscribers are called synchronously before this returns.
   */
  readonly publish: (event: AnyRuntimeEvent) => void;

  /**
   * Return an immutable snapshot of all events published in this run.
   */
  readonly history: () => readonly AnyRuntimeEvent[];

  /**
   * Total events published so far.
   */
  readonly eventCount: () => number;
}

/**
 * Create a new RuntimeEventBus instance.
 */
export const createRuntimeEventBus = (): RuntimeEventBus => {
  const typeSubscribers = new Map<RuntimeEventType, RuntimeEventHandler[]>();
  const allSubscribers: RuntimeEventHandler[] = [];
  const log: AnyRuntimeEvent[] = [];

  const subscribe = <T extends AnyRuntimeEvent>(
    type: RuntimeEventType,
    handler: RuntimeEventHandler<T>,
  ): void => {
    const handlers = typeSubscribers.get(type) ?? [];
    handlers.push(handler as RuntimeEventHandler);
    typeSubscribers.set(type, handlers);
  };

  const subscribeAll = (handler: RuntimeEventHandler): void => {
    allSubscribers.push(handler);
  };

  const publish = (event: AnyRuntimeEvent): void => {
    log.push(event);
    const handlers = typeSubscribers.get(event.type) ?? [];
    for (const h of handlers) h(event);
    for (const h of allSubscribers) h(event);
  };

  const history = (): readonly AnyRuntimeEvent[] => Object.freeze([...log]);
  const eventCount = (): number => log.length;

  return Object.freeze({ subscribe, subscribeAll, publish, history, eventCount });
};
