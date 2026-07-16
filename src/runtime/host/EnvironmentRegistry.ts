import type { HostEnvironment } from "./types";

export class EnvironmentRegistry {
  private readonly environments = new Map<string, HostEnvironment>();

  register(environment: HostEnvironment): void {
    if (this.environments.has(environment.id)) {
      throw new Error(`Environment already registered: ${environment.id}`);
    }
    this.environments.set(environment.id, {
      ...environment,
      variables: Object.freeze({ ...environment.variables }),
    });
  }

  get(id: string): HostEnvironment {
    const environment = this.environments.get(id);
    if (!environment) {
      throw new Error(`Unknown environment: ${id}`);
    }
    return environment;
  }

  list(): readonly HostEnvironment[] {
    return Object.freeze([...this.environments.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
}
