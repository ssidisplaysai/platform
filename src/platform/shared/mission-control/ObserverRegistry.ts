import { deterministicSort } from "../utilities";

export type MissionControlObserver<TObservation> = {
  observerId: string;
  receiveObservation(observation: TObservation): Promise<void>;
};

export class ObserverRegistry<TObservation> {
  private readonly observers = new Map<string, MissionControlObserver<TObservation>>();

  register(observer: MissionControlObserver<TObservation>): void {
    if (!observer.observerId || this.observers.has(observer.observerId)) {
      throw new Error(`observer registration conflict: ${observer.observerId}`);
    }
    this.observers.set(observer.observerId, observer);
  }

  listObservers(): MissionControlObserver<TObservation>[] {
    return deterministicSort([...this.observers.values()], (observer) => observer.observerId);
  }
}
