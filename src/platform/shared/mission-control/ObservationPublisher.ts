import { ObserverRegistry } from "./ObserverRegistry";

export class ObservationPublisher<TObservation> {
  constructor(private readonly observers: ObserverRegistry<TObservation>) {}

  async publish(observation: TObservation): Promise<void> {
    for (const observer of this.observers.listObservers()) {
      await observer.receiveObservation(observation);
    }
  }
}
