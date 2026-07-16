import type {
  RuntimeBehaviorDescriptor,
  RuntimeBehaviorExecutionResult,
  RuntimeBehaviorImplementation,
  RuntimeCapabilityDispatchRequest,
  RuntimeObjectLifecycleState,
  RuntimeObjectRecord,
} from "./types";

interface RuntimeBehaviorBinding {
  descriptor: RuntimeBehaviorDescriptor;
  implementation: RuntimeBehaviorImplementation;
}

export class RuntimeBehaviorRegistry {
  private readonly capabilities = new Map<string, Readonly<{ capabilityId: string; action: string; resourcePattern: string; allowedStates: readonly RuntimeObjectLifecycleState[]; requiredPermissions: readonly string[] }>>();
  private readonly behaviors = new Map<string, RuntimeBehaviorBinding>();

  registerCapability(descriptor: {
    capabilityId: string;
    action: string;
    resourcePattern: string;
    allowedStates: readonly RuntimeObjectLifecycleState[];
    requiredPermissions: readonly string[];
  }): void {
    if (this.capabilities.has(descriptor.capabilityId)) {
      throw new Error(`GRT-OBJ-BEH-001: Duplicate capability registration: ${descriptor.capabilityId}`);
    }

    this.capabilities.set(descriptor.capabilityId, Object.freeze({
      ...descriptor,
      allowedStates: Object.freeze([...descriptor.allowedStates].sort((a, b) => a.localeCompare(b))),
      requiredPermissions: Object.freeze([...descriptor.requiredPermissions].sort((a, b) => a.localeCompare(b))),
    }));
  }

  registerBehavior(descriptor: RuntimeBehaviorDescriptor, implementation: RuntimeBehaviorImplementation): void {
    if (!this.capabilities.has(descriptor.capabilityId)) {
      throw new Error(`GRT-OBJ-BEH-002: Behavior references unknown capability: ${descriptor.capabilityId}`);
    }

    if (this.behaviors.has(descriptor.behaviorId)) {
      throw new Error(`GRT-OBJ-BEH-003: Duplicate behavior registration: ${descriptor.behaviorId}`);
    }

    this.behaviors.set(descriptor.behaviorId, {
      descriptor: Object.freeze({ ...descriptor }),
      implementation,
    });
  }

  resolveBehavior(capabilityId: string, classification: string): RuntimeBehaviorBinding {
    const candidate = [...this.behaviors.values()]
      .filter((entry) => entry.descriptor.capabilityId === capabilityId && entry.descriptor.objectClassification === classification)
      .sort((a, b) => a.descriptor.behaviorId.localeCompare(b.descriptor.behaviorId));

    if (candidate.length === 0) {
      throw new Error(`GRT-OBJ-BEH-004: No behavior bound for capability ${capabilityId} and classification ${classification}`);
    }

    return candidate[0];
  }

  capability(capabilityId: string): Readonly<{ capabilityId: string; action: string; resourcePattern: string; allowedStates: readonly RuntimeObjectLifecycleState[]; requiredPermissions: readonly string[] }> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`GRT-OBJ-BEH-005: Unknown capability: ${capabilityId}`);
    }
    return capability;
  }

  execute(binding: RuntimeBehaviorBinding, object: RuntimeObjectRecord, request: RuntimeCapabilityDispatchRequest): RuntimeBehaviorExecutionResult {
    return binding.implementation(object, request);
  }

  listCapabilities(): readonly Readonly<{ capabilityId: string; action: string; resourcePattern: string; allowedStates: readonly RuntimeObjectLifecycleState[]; requiredPermissions: readonly string[] }>[] {
    return Object.freeze([...this.capabilities.values()].sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)));
  }

  listBehaviors(): readonly RuntimeBehaviorDescriptor[] {
    return Object.freeze([...this.behaviors.values()].map((entry) => entry.descriptor).sort((a, b) => a.behaviorId.localeCompare(b.behaviorId)));
  }
}
