export class ValidatorRegistry<T = unknown> {
  private readonly validators = new Map<string, T>();

  register(id: string, validator: T): void {
    this.validators.set(id, validator);
  }

  resolve(id: string): T {
    const validator = this.validators.get(id);
    if (validator === undefined) {
      throw new Error(`Validator not found: ${id}`);
    }

    return validator;
  }

  list(): readonly string[] {
    return [...this.validators.keys()].sort();
  }
}