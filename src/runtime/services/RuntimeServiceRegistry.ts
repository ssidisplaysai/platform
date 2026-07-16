import { createHash } from "node:crypto";

import type { RuntimeServiceDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function stableSerialize(descriptor: RuntimeServiceDescriptor): string {
  const metadata = descriptor.metadata
    ? Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0])))
    : {};

  return JSON.stringify({
    id: descriptor.id,
    version: descriptor.version,
    dependencies: [...descriptor.dependencies].sort((a, b) => a.localeCompare(b)),
    metadata,
    failOnActivate: descriptor.failOnActivate ?? false,
  });
}

export class RuntimeServiceRegistry {
  private readonly descriptors = new Map<string, RuntimeServiceDescriptor>();

  register(descriptor: RuntimeServiceDescriptor): void {
    this.validateDescriptor(descriptor);
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`GRT-SVC-REG-001: Duplicate service registration: ${descriptor.id}`);
    }

    const normalized = deepFreeze({
      ...descriptor,
      dependencies: Object.freeze([...descriptor.dependencies].sort((a, b) => a.localeCompare(b))),
      metadata: descriptor.metadata
        ? Object.freeze(Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0]))))
        : undefined,
      failOnActivate: descriptor.failOnActivate ?? false,
    });
    this.descriptors.set(normalized.id, normalized);
  }

  get(id: string): RuntimeServiceDescriptor {
    const descriptor = this.descriptors.get(id);
    if (!descriptor) {
      throw new Error(`GRT-SVC-REG-002: Unknown service descriptor: ${id}`);
    }
    return descriptor;
  }

  list(): readonly RuntimeServiceDescriptor[] {
    return Object.freeze([...this.descriptors.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  identityFor(id: string): string {
    const descriptor = this.get(id);
    const hash = createHash("sha256").update(stableSerialize(descriptor)).digest("hex");
    return `service-${hash.slice(0, 16)}`;
  }

  private validateDescriptor(descriptor: RuntimeServiceDescriptor): void {
    if (!descriptor.id || descriptor.id.trim().length === 0) {
      throw new Error("GRT-SVC-REG-003: Service id is required");
    }
    if (!descriptor.version || descriptor.version.trim().length === 0) {
      throw new Error(`GRT-SVC-REG-004: Service version is required for ${descriptor.id}`);
    }

    const deps = [...descriptor.dependencies].sort((a, b) => a.localeCompare(b));
    if (deps.some((dep) => dep === descriptor.id)) {
      throw new Error(`GRT-SVC-REG-005: Service cannot depend on itself: ${descriptor.id}`);
    }

    for (let index = 1; index < deps.length; index += 1) {
      if (deps[index] === deps[index - 1]) {
        throw new Error(`GRT-SVC-REG-006: Duplicate dependency in descriptor ${descriptor.id}: ${deps[index]}`);
      }
    }
  }
}
