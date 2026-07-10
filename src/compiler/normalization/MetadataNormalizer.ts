export class MetadataNormalizer {
  normalize(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!metadata) {
      return {};
    }

    return this.sortObject(metadata) as Record<string, unknown>;
  }

  private sortObject(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObject(item));
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const sortedKeys = Object.keys(record).sort();
      const result: Record<string, unknown> = {};

      for (const key of sortedKeys) {
        result[key] = this.sortObject(record[key]);
      }

      return result;
    }

    return value;
  }
}
