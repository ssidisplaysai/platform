import { createHash } from "node:crypto";

import { RuntimeObject } from "./RuntimeObject";
import type { RuntimeObjectDescriptor, RuntimeObjectHealth, RuntimeObjectLifecycleState, RuntimeObjectRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function stableCanonicalDescriptor(descriptor: RuntimeObjectDescriptor): string {
  return JSON.stringify({
    descriptorId: descriptor.descriptorId,
    classification: descriptor.classification,
    version: descriptor.version,
    metadata: Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0]))),
    initialState: Object.fromEntries(Object.entries(descriptor.initialState).sort((a, b) => a[0].localeCompare(b[0]))),
    behaviorRefs: [...descriptor.behaviorRefs].sort((a, b) => a.localeCompare(b)),
    capabilityRefs: [...descriptor.capabilityRefs].sort((a, b) => a.localeCompare(b)),
    relationshipRefs: [...(descriptor.relationshipRefs ?? [])].sort((a, b) => a.localeCompare(b)),
  });
}

export class RuntimeObjectFactory {
  identityFor(descriptor: RuntimeObjectDescriptor): string {
    const hash = createHash("sha256").update(stableCanonicalDescriptor(descriptor)).digest("hex");
    return `object-${hash.slice(0, 16)}`;
  }

  create(descriptor: RuntimeObjectDescriptor): RuntimeObject {
    this.validateDescriptor(descriptor);
    const objectId = this.identityFor(descriptor);

    const record: RuntimeObjectRecord = {
      objectId,
      descriptorId: descriptor.descriptorId,
      classification: descriptor.classification,
      version: descriptor.version,
      lifecycleState: "Declared",
      health: "healthy",
      metadata: deepFreeze(Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0])))),
      state: deepFreeze(Object.fromEntries(Object.entries(descriptor.initialState).sort((a, b) => a[0].localeCompare(b[0])))),
      relationshipRefs: Object.freeze([...(descriptor.relationshipRefs ?? [])].sort((a, b) => a.localeCompare(b))),
      behaviorRefs: Object.freeze([...descriptor.behaviorRefs].sort((a, b) => a.localeCompare(b)),
      ),
      evidenceRefs: Object.freeze([]),
      snapshotRefs: Object.freeze([]),
    };

    return new RuntimeObject(deepFreeze(record));
  }

  evolve(
    current: RuntimeObjectRecord,
    updates: {
      lifecycleState?: RuntimeObjectLifecycleState;
      health?: RuntimeObjectHealth;
      state?: Readonly<Record<string, unknown>>;
      relationshipRefs?: readonly string[];
      evidenceRefs?: readonly number[];
      snapshotRefs?: readonly number[];
      lastFailure?: string;
    },
  ): RuntimeObject {
    return new RuntimeObject(deepFreeze({
      ...current,
      lifecycleState: updates.lifecycleState ?? current.lifecycleState,
      health: updates.health ?? current.health,
      state: updates.state ? deepFreeze(Object.fromEntries(Object.entries(updates.state).sort((a, b) => a[0].localeCompare(b[0])))) : current.state,
      relationshipRefs: updates.relationshipRefs ? Object.freeze([...updates.relationshipRefs].sort((a, b) => a.localeCompare(b))) : current.relationshipRefs,
      evidenceRefs: updates.evidenceRefs ? Object.freeze([...updates.evidenceRefs].sort((a, b) => a - b)) : current.evidenceRefs,
      snapshotRefs: updates.snapshotRefs ? Object.freeze([...updates.snapshotRefs].sort((a, b) => a - b)) : current.snapshotRefs,
      lastFailure: updates.lastFailure ?? current.lastFailure,
    }));
  }

  private validateDescriptor(descriptor: RuntimeObjectDescriptor): void {
    if (!descriptor.descriptorId || descriptor.descriptorId.trim().length === 0) {
      throw new Error("GRT-OBJ-FACTORY-001: descriptorId is required");
    }
    if (!descriptor.classification || descriptor.classification.trim().length === 0) {
      throw new Error(`GRT-OBJ-FACTORY-002: classification is required for descriptor ${descriptor.descriptorId}`);
    }
    if (!descriptor.version || descriptor.version.trim().length === 0) {
      throw new Error(`GRT-OBJ-FACTORY-003: version is required for descriptor ${descriptor.descriptorId}`);
    }
  }
}
