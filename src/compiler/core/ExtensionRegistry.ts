export class ExtensionRegistry<T = unknown> {
  private readonly extensions = new Map<string, T>();

  register(id: string, extension: T): void {
    this.extensions.set(id, extension);
  }

  resolve(id: string): T {
    const extension = this.extensions.get(id);
    if (extension === undefined) {
      throw new Error(`Extension not found: ${id}`);
    }

    return extension;
  }

  list(): readonly string[] {
    return [...this.extensions.keys()].sort();
  }
}