import { RuntimeObjectFactory } from "./RuntimeObjectFactory";
import type { RuntimeObjectDescriptor, RuntimeObjectRecord } from "./types";

export class RuntimeObjectRegistry {
  private readonly factory = new RuntimeObjectFactory();
  private readonly records = new Map<string, RuntimeObjectRecord>();

  register(descriptor: RuntimeObjectDescriptor): RuntimeObjectRecord {
    const record = this.factory.create(descriptor).snapshot();
    if (this.records.has(record.objectId)) {
      throw new Error(`GRT-OBJ-REG-001: Duplicate object registration: ${record.objectId}`);
    }

    this.records.set(record.objectId, record);
    return record;
  }

  get(objectId: string): RuntimeObjectRecord {
    const record = this.records.get(objectId);
    if (!record) {
      throw new Error(`GRT-OBJ-REG-002: Unknown runtime object: ${objectId}`);
    }
    return record;
  }

  update(record: RuntimeObjectRecord): void {
    if (!this.records.has(record.objectId)) {
      throw new Error(`GRT-OBJ-REG-003: Cannot update unknown runtime object: ${record.objectId}`);
    }
    this.records.set(record.objectId, record);
  }

  list(): readonly RuntimeObjectRecord[] {
    return Object.freeze([...this.records.values()].sort((a, b) => a.objectId.localeCompare(b.objectId)));
  }

  has(objectId: string): boolean {
    return this.records.has(objectId);
  }
}
