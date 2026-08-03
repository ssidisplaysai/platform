export interface Clock {
  now(): Date;
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }
}

export class TestClock implements Clock {
  private current: Date;

  constructor(seed: string | Date) {
    this.current = seed instanceof Date ? new Date(seed.getTime()) : new Date(seed);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  set(value: string | Date): void {
    this.current = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
