export class GeneratorRegistry<T = unknown> {
  private readonly generators = new Map<string, T>();

  register(id: string, generator: T): void {
    this.generators.set(id, generator);
  }

  resolve(id: string): T {
    const generator = this.generators.get(id);
    if (generator === undefined) {
      throw new Error(`Generator not found: ${id}`);
    }

    return generator;
  }

  list(): readonly string[] {
    return [...this.generators.keys()].sort();
  }
}