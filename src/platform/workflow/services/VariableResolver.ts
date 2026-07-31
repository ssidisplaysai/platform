export class VariableResolver {
  resolve<TValue>(value: TValue, variables: Record<string, unknown>): TValue {
    if (typeof value === "string") {
      return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_full, key: string) => {
        const resolved = variables[key];
        return resolved === undefined || resolved === null ? "" : String(resolved);
      }) as TValue;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.resolve(entry, variables)) as TValue;
    }

    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        this.resolve(entry, variables),
      ]);
      return Object.fromEntries(entries) as TValue;
    }

    return value;
  }
}
