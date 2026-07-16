import type { DependencyRegistration, RuntimeKernelDiagnostic } from "./types";

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export class DependencyContainer {
  private readonly registrations = new Map<string, DependencyRegistration>();

  register(registration: DependencyRegistration): RuntimeKernelDiagnostic[] {
    if (this.registrations.has(registration.id)) {
      return [{
        code: "GRT-DI-001",
        severity: "Error",
        category: "Dependency",
        message: `Duplicate dependency registration: ${registration.id}`,
        blocking: true,
        sourceId: registration.id,
      }];
    }

    this.registrations.set(registration.id, {
      ...registration,
      dependencies: sortUnique(registration.dependencies),
    });
    return [];
  }

  validate(): RuntimeKernelDiagnostic[] {
    const diagnostics: RuntimeKernelDiagnostic[] = [];
    const byConsumerContract = new Map<string, DependencyRegistration[]>();

    for (const registration of this.registrations.values()) {
      const consumerContractKey = `${registration.id}::${registration.contract}`;
      byConsumerContract.set(consumerContractKey, [
        ...(byConsumerContract.get(consumerContractKey) ?? []),
        registration,
      ]);

      for (const dependency of registration.dependencies) {
        if (!this.registrations.has(dependency)) {
          diagnostics.push({
            code: "GRT-DI-002",
            severity: "Warning",
            category: "Dependency",
            message: `Unresolved dependency reference ${dependency} for ${registration.id}`,
            blocking: false,
            sourceId: registration.id,
          });
        }
      }
    }

    for (const [consumerContract, list] of byConsumerContract.entries()) {
      const uniqueProviders = new Set(list.map((entry) => entry.providerId));
      if (uniqueProviders.size > 1 && list.some((entry) => !entry.external)) {
        diagnostics.push({
          code: "GRT-DI-003",
          severity: "Error",
          category: "Dependency",
          message: `Invalid providers for consumer contract ${consumerContract}`,
          blocking: true,
        });
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const walk = (id: string): boolean => {
      if (visiting.has(id)) {
        return true;
      }
      if (visited.has(id)) {
        return false;
      }
      visiting.add(id);
      const registration = this.registrations.get(id);
      for (const dep of registration?.dependencies ?? []) {
        if (walk(dep)) {
          return true;
        }
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };

    for (const id of [...this.registrations.keys()].sort((a, b) => a.localeCompare(b))) {
      if (walk(id)) {
        diagnostics.push({
          code: "GRT-DI-004",
          severity: "Critical",
          category: "Dependency",
          message: `Circular dependency detected at ${id}`,
          blocking: true,
          sourceId: id,
        });
      }
    }

    return diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  }

  snapshot(): Readonly<Record<string, DependencyRegistration>> {
    return Object.freeze(Object.fromEntries([...this.registrations.entries()].sort((a, b) => a[0].localeCompare(b[0]))));
  }
}
