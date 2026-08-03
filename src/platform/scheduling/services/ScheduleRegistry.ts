import type { ScheduleDefinition, ScheduleId, ScheduleType } from "../contracts";

function cloneDefinition(definition: ScheduleDefinition): ScheduleDefinition {
  return structuredClone(definition);
}

function hasValidTimeZone(ianaName: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: ianaName }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export class ScheduleRegistry {
  private readonly definitions = new Map<ScheduleId, ScheduleDefinition[]>();

  register(definition: ScheduleDefinition): void {
    this.validate(definition);
    const existing = this.definitions.get(definition.scheduleId) ?? [];

    const duplicateVersion = existing.some((entry) => this.sameVersion(entry, definition));
    if (duplicateVersion) {
      throw new Error(`schedule_duplicate:${definition.scheduleId}`);
    }

    const activeVersion = existing.find((entry) => entry.state === "ACTIVE");
    if (activeVersion && definition.state === "ACTIVE") {
      throw new Error(`schedule_active_version_conflict:${definition.scheduleId}`);
    }

    existing.push(cloneDefinition(definition));
    this.definitions.set(definition.scheduleId, existing);
  }

  update(definition: ScheduleDefinition): void {
    this.validate(definition);
    const existing = this.definitions.get(definition.scheduleId) ?? [];
    if (existing.length === 0) {
      throw new Error(`schedule_not_found:${definition.scheduleId}`);
    }

    const index = existing.findIndex((entry) => this.sameVersion(entry, definition));
    if (index < 0) {
      if (existing.some((entry) => entry.state === "ACTIVE") && definition.state === "ACTIVE") {
        throw new Error(`schedule_active_version_conflict:${definition.scheduleId}`);
      }
      existing.push(cloneDefinition(definition));
      this.definitions.set(definition.scheduleId, existing);
      return;
    }

    const replacingActive = existing[index].state === "ACTIVE" && definition.state === "ACTIVE";
    if (replacingActive && !this.sameVersion(existing[index], definition)) {
      throw new Error(`schedule_active_version_conflict:${definition.scheduleId}`);
    }

    existing[index] = cloneDefinition(definition);
    this.definitions.set(definition.scheduleId, existing);
  }

  get(scheduleId: ScheduleId): ScheduleDefinition {
    const versions = this.definitions.get(scheduleId);
    if (!versions || versions.length === 0) {
      throw new Error(`schedule_not_found:${scheduleId}`);
    }

    return cloneDefinition(this.latest(versions));
  }

  list(): ScheduleDefinition[] {
    return [...this.definitions.values()].flat().map((entry) => cloneDefinition(entry));
  }

  deactivate(scheduleId: ScheduleId, actorId: string): ScheduleDefinition {
    const definition = this.get(scheduleId);
    if (definition.state !== "ACTIVE") {
      throw new Error(`schedule_not_active:${scheduleId}`);
    }

    const updated: ScheduleDefinition = {
      ...definition,
      state: "PAUSED",
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    this.update(updated);
    return updated;
  }

  restore(definitions: ScheduleDefinition[]): void {
    this.definitions.clear();
    for (const definition of definitions) {
      const current = this.definitions.get(definition.scheduleId) ?? [];
      current.push(cloneDefinition(definition));
      this.definitions.set(definition.scheduleId, current);
    }
  }

  count(): number {
    return this.list().length;
  }

  private latest(definitions: ScheduleDefinition[]): ScheduleDefinition {
    const sorted = [...definitions].sort((a, b) => {
      return (a.version.major - b.version.major)
        || (a.version.minor - b.version.minor)
        || (a.version.patch - b.version.patch);
    });
    return sorted[sorted.length - 1];
  }

  private sameVersion(a: ScheduleDefinition, b: ScheduleDefinition): boolean {
    return a.version.major === b.version.major && a.version.minor === b.version.minor && a.version.patch === b.version.patch;
  }

  private validate(definition: ScheduleDefinition): void {
    if (!definition.scheduleId || !definition.name || !definition.command?.topic) {
      throw new Error("schedule_invalid_definition:missing_required_fields");
    }

    if (!hasValidTimeZone(definition.timezone.ianaName)) {
      throw new Error("schedule_invalid_time_zone");
    }

    if (definition.maxOccurrences !== undefined && definition.maxOccurrences <= 0) {
      throw new Error("schedule_invalid_definition:max_occurrences");
    }

    this.validateTypeSpecific(definition.scheduleType, definition);
  }

  private validateTypeSpecific(type: ScheduleType, definition: ScheduleDefinition): void {
    if (type === "ONE_TIME" && !definition.oneTime?.runAt) {
      throw new Error("schedule_invalid_definition:one_time");
    }

    if (type === "INTERVAL" && (!definition.interval || definition.interval.intervalMs <= 0)) {
      throw new Error("schedule_invalid_definition:interval");
    }

    if (type === "RECURRING") {
      const recurring = definition.recurring;
      if (!recurring || recurring.interval <= 0 || !recurring.timeOfDay) {
        throw new Error("schedule_invalid_definition:recurring");
      }
    }

    if (type === "CRON" && !definition.cron?.expression) {
      throw new Error("schedule_invalid_definition:cron");
    }

    if (type === "CALENDAR" && !definition.calendar?.timeOfDay) {
      throw new Error("schedule_invalid_definition:calendar");
    }
  }
}
