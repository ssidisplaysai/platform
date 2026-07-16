import type { RuntimeConfiguration } from "./types";

export class RuntimeConfigurationManager {
  private configuration: RuntimeConfiguration;

  constructor(configuration?: Partial<RuntimeConfiguration>) {
    this.configuration = {
      environment: configuration?.environment ?? "production",
      profile: configuration?.profile ?? "default",
      featureFlags: Object.freeze({ ...(configuration?.featureFlags ?? {}) }),
      runtimeOptions: Object.freeze({ ...(configuration?.runtimeOptions ?? {}) }),
    };
  }

  getConfiguration(): RuntimeConfiguration {
    return Object.freeze({
      ...this.configuration,
      featureFlags: Object.freeze({ ...this.configuration.featureFlags }),
      runtimeOptions: Object.freeze({ ...this.configuration.runtimeOptions }),
    });
  }
}
