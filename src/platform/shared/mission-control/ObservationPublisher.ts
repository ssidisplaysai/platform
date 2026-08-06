import { ObserverRegistry } from "./ObserverRegistry";

export class ObservationPublisher<TObservation> {
  constructor(private readonly observers: ObserverRegistry<TObservation>) {}

  async publish(observation: TObservation): Promise<void> {
    const failures: string[] = [];
    for (const observer of this.observers.listObservers()) {
      try {
        await observer.receiveObservation(structuredClone(observation));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        failures.push(`${observer.observerId}: ${reason}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`observation publish failed for ${failures.length} observer(s): ${failures.join(" | ")}`);
    }
  }
}
