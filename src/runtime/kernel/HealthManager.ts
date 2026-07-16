export interface HealthSnapshot {
  runtime: number;
  module: number;
  service: number;
  plugin: number;
  workflow: number;
  scheduler: number;
  dependency: number;
}

export class HealthManager {
  private snapshot: HealthSnapshot = {
    runtime: 100,
    module: 100,
    service: 100,
    plugin: 100,
    workflow: 100,
    scheduler: 100,
    dependency: 100,
  };

  update(values: Partial<HealthSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...values,
    };
  }

  overallScore(): number {
    const values = Object.values(this.snapshot);
    return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
  }

  get(): Readonly<HealthSnapshot> {
    return Object.freeze({ ...this.snapshot });
  }
}
