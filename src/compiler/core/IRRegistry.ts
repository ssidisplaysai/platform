export class IRRegistry<T = unknown> {
  private readonly entries = new Map<string, T>();

  register(id: string, value: T): void {
    this.entries.set(id, value);
  }

  resolve(id: string): T {
    const value = this.entries.get(id);
    if (value === undefined) {
      throw new Error(`IR not found: ${id}`);
    }

    return value;
  }

  list(): readonly string[] {
    return [...this.entries.keys()].sort();
  }
}