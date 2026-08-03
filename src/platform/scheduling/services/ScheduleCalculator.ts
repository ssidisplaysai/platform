import type {
  CalendarSchedule,
  CronSchedule,
  IntervalSchedule,
  NextRun,
  RecurringSchedule,
  ScheduleDefinition,
} from "../contracts";
import type { Clock } from "./Clock";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export type OccurrenceTimeClassification = {
  localRunKey: string;
  utcOffsetMinutes: number | null;
  isDstAmbiguous: boolean;
};

type CronMatcher = {
  minute: (value: number) => boolean;
  hour: (value: number) => boolean;
  dayOfMonth: (value: number) => boolean;
  month: (value: number) => boolean;
  dayOfWeek: (value: number) => boolean;
  dayOfMonthWildcard: boolean;
  dayOfWeekWildcard: boolean;
};

const WEEKDAY_LOOKUP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export class ScheduleCalculator {
  constructor(private readonly clock: Clock) {}

  classifyOccurrenceTime(definition: ScheduleDefinition, dueAt: string): OccurrenceTimeClassification {
    const candidate = new Date(dueAt);
    if (Number.isNaN(candidate.getTime())) {
      return {
        localRunKey: `${definition.timezone.ianaName}:invalid:${dueAt}`,
        utcOffsetMinutes: null,
        isDstAmbiguous: false,
      };
    }

    const currentParts = this.getZonedParts(candidate, definition.timezone.ianaName);
    const currentOffset = this.getUtcOffsetMinutes(candidate, definition.timezone.ianaName);
    const localRunKey = this.toLocalRunKey(definition.timezone.ianaName, currentParts);

    // We classify fall-back repeated local hours by checking neighboring UTC instants.
    const previous = new Date(candidate.getTime() - 60 * 60_000);
    const next = new Date(candidate.getTime() + 60 * 60_000);
    const previousKey = this.toLocalRunKey(definition.timezone.ianaName, this.getZonedParts(previous, definition.timezone.ianaName));
    const nextKey = this.toLocalRunKey(definition.timezone.ianaName, this.getZonedParts(next, definition.timezone.ianaName));
    const previousOffset = this.getUtcOffsetMinutes(previous, definition.timezone.ianaName);
    const nextOffset = this.getUtcOffsetMinutes(next, definition.timezone.ianaName);

    const isDstAmbiguous = (
      (previousKey === localRunKey && previousOffset !== currentOffset)
      || (nextKey === localRunKey && nextOffset !== currentOffset)
    );

    return {
      localRunKey,
      utcOffsetMinutes: currentOffset,
      isDstAmbiguous,
    };
  }

  nextRun(definition: ScheduleDefinition, from?: Date, completedOccurrences = 0): NextRun {
    const reference = from ?? this.clock.now();

    if (definition.maxOccurrences !== undefined && completedOccurrences >= definition.maxOccurrences) {
      return { nextRunAt: null, reason: "COMPLETED" };
    }

    try {
      switch (definition.scheduleType) {
        case "ONE_TIME":
          return this.nextOneTime(definition, reference);
        case "INTERVAL":
          return this.nextInterval(definition, reference);
        case "RECURRING":
          return this.nextRecurring(definition, reference);
        case "CRON":
          return this.nextCron(definition, reference);
        case "CALENDAR":
          return this.nextCalendar(definition, reference);
        default:
          return { nextRunAt: null, reason: "INVALID_DEFINITION" };
      }
    } catch {
      return { nextRunAt: null, reason: "INVALID_DEFINITION" };
    }
  }

  calculateDueRuns(
    definition: ScheduleDefinition,
    nextRunAt: string,
    evaluatedAt: Date,
    maxCount = 250,
  ): string[] {
    const due: string[] = [];
    let cursor = new Date(nextRunAt);

    for (let i = 0; i < maxCount; i += 1) {
      if (cursor.getTime() > evaluatedAt.getTime()) {
        break;
      }

      due.push(cursor.toISOString());
      const next = this.nextRun(definition, new Date(cursor.getTime() + 1000));
      if (!next.nextRunAt) {
        break;
      }
      cursor = new Date(next.nextRunAt);
    }

    return due;
  }

  private nextOneTime(definition: ScheduleDefinition, from: Date): NextRun {
    const runAt = definition.oneTime?.runAt;
    if (!runAt) {
      throw new Error("invalid_one_time");
    }

    const at = new Date(runAt);
    if (Number.isNaN(at.getTime())) {
      throw new Error("invalid_date");
    }

    if (at.getTime() < from.getTime()) {
      return { nextRunAt: null, reason: "OUT_OF_WINDOW" };
    }

    if (definition.endAt && at.getTime() > new Date(definition.endAt).getTime()) {
      return { nextRunAt: null, reason: "OUT_OF_WINDOW" };
    }

    return { nextRunAt: at.toISOString(), reason: "READY" };
  }

  private nextInterval(definition: ScheduleDefinition, from: Date): NextRun {
    const interval = definition.interval as IntervalSchedule | undefined;
    if (!interval || interval.intervalMs <= 0) {
      throw new Error("invalid_interval");
    }

    const start = new Date(interval.anchorAt ?? definition.startAt ?? from.toISOString());
    const ref = Math.max(from.getTime(), start.getTime());

    const elapsed = Math.max(0, ref - start.getTime());
    const steps = Math.floor(elapsed / interval.intervalMs);
    const candidate = new Date(start.getTime() + (steps * interval.intervalMs));
    const next = candidate.getTime() <= from.getTime()
      ? new Date(candidate.getTime() + interval.intervalMs)
      : candidate;

    if (definition.endAt && next.getTime() > new Date(definition.endAt).getTime()) {
      return { nextRunAt: null, reason: "OUT_OF_WINDOW" };
    }

    return { nextRunAt: next.toISOString(), reason: "READY" };
  }

  private nextRecurring(definition: ScheduleDefinition, from: Date): NextRun {
    const recurring = definition.recurring as RecurringSchedule | undefined;
    if (!recurring || recurring.interval <= 0) {
      throw new Error("invalid_recurring");
    }

    return this.scanFuture(definition, from, (candidate) => {
      const parts = this.getZonedParts(candidate, definition.timezone.ianaName);
      const [hour, minute] = this.parseTimeOfDay(recurring.timeOfDay);
      if (parts.hour !== hour || parts.minute !== minute) {
        return false;
      }

      const base = new Date(definition.startAt ?? candidate.toISOString());
      const baseParts = this.getZonedParts(base, definition.timezone.ianaName);

      if (recurring.frequency === "DAILY") {
        const days = this.diffDays(baseParts, parts);
        return days >= 0 && days % recurring.interval === 0;
      }

      if (recurring.frequency === "WEEKLY") {
        if (recurring.daysOfWeek && recurring.daysOfWeek.length > 0 && !recurring.daysOfWeek.includes(parts.weekday)) {
          return false;
        }
        const days = this.diffDays(baseParts, parts);
        const weeks = Math.floor(days / 7);
        return weeks >= 0 && weeks % recurring.interval === 0;
      }

      if (recurring.frequency === "MONTHLY") {
        const monthDiff = ((parts.year - baseParts.year) * 12) + (parts.month - baseParts.month);
        const targetDay = recurring.dayOfMonth ?? baseParts.day;
        return monthDiff >= 0 && monthDiff % recurring.interval === 0 && parts.day === targetDay;
      }

      return false;
    });
  }

  private nextCron(definition: ScheduleDefinition, from: Date): NextRun {
    const cron = definition.cron as CronSchedule | undefined;
    if (!cron?.expression) {
      throw new Error("invalid_cron");
    }

    const matcher = this.parseCron(cron.expression);
    return this.scanFuture(definition, from, (candidate) => {
      const parts = this.getZonedParts(candidate, definition.timezone.ianaName);
      const dayMatch = matcher.dayOfMonthWildcard || matcher.dayOfWeekWildcard
        ? matcher.dayOfMonth(parts.day) && matcher.dayOfWeek(parts.weekday)
        : matcher.dayOfMonth(parts.day) || matcher.dayOfWeek(parts.weekday);

      return matcher.minute(parts.minute)
        && matcher.hour(parts.hour)
        && matcher.month(parts.month)
        && dayMatch;
    });
  }

  private nextCalendar(definition: ScheduleDefinition, from: Date): NextRun {
    const calendar = definition.calendar as CalendarSchedule | undefined;
    if (!calendar?.timeOfDay) {
      throw new Error("invalid_calendar");
    }

    const [hour, minute] = this.parseTimeOfDay(calendar.timeOfDay);
    return this.scanFuture(definition, from, (candidate) => {
      const parts = this.getZonedParts(candidate, definition.timezone.ianaName);
      if (parts.hour !== hour || parts.minute !== minute) {
        return false;
      }

      if (calendar.months && calendar.months.length > 0 && !calendar.months.includes(parts.month)) {
        return false;
      }

      if (calendar.daysOfMonth && calendar.daysOfMonth.length > 0 && !calendar.daysOfMonth.includes(parts.day)) {
        return false;
      }

      if (calendar.daysOfWeek && calendar.daysOfWeek.length > 0 && !calendar.daysOfWeek.includes(parts.weekday)) {
        return false;
      }

      return true;
    });
  }

  private scanFuture(definition: ScheduleDefinition, from: Date, matcher: (candidate: Date) => boolean): NextRun {
    const startBoundary = definition.startAt ? new Date(definition.startAt) : null;
    const endBoundary = definition.endAt ? new Date(definition.endAt) : null;
    const begin = new Date(from.getTime() + 60_000 - (from.getTime() % 60_000));

    const maxScanMinutes = 366 * 24 * 60;
    for (let minute = 0; minute < maxScanMinutes; minute += 1) {
      const candidate = new Date(begin.getTime() + (minute * 60_000));

      if (startBoundary && candidate.getTime() < startBoundary.getTime()) {
        continue;
      }

      if (endBoundary && candidate.getTime() > endBoundary.getTime()) {
        return { nextRunAt: null, reason: "OUT_OF_WINDOW" };
      }

      if (matcher(candidate)) {
        return { nextRunAt: candidate.toISOString(), reason: "READY" };
      }
    }

    return { nextRunAt: null, reason: "OUT_OF_WINDOW" };
  }

  private parseCron(expression: string): CronMatcher {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new Error("invalid_cron_expression");
    }

    return {
      minute: this.parseCronField(fields[0], 0, 59),
      hour: this.parseCronField(fields[1], 0, 23),
      dayOfMonth: this.parseCronField(fields[2], 1, 31),
      month: this.parseCronField(fields[3], 1, 12),
      dayOfWeek: this.parseCronField(fields[4], 0, 6),
      dayOfMonthWildcard: fields[2] === "*",
      dayOfWeekWildcard: fields[4] === "*",
    };
  }

  private parseCronField(field: string, min: number, max: number): (value: number) => boolean {
    const values = new Set<number>();

    for (const part of field.split(",")) {
      if (part === "*") {
        for (let value = min; value <= max; value += 1) {
          values.add(value);
        }
        continue;
      }

      const [rangePart, stepPart] = part.split("/");
      const step = stepPart ? Number(stepPart) : 1;
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error("invalid_cron_step");
      }

      if (rangePart.includes("-")) {
        const [rawStart, rawEnd] = rangePart.split("-");
        const start = Number(rawStart);
        const end = Number(rawEnd);
        for (let value = start; value <= end; value += step) {
          if (value >= min && value <= max) {
            values.add(value);
          }
        }
        continue;
      }

      const value = Number(rangePart);
      if (!Number.isFinite(value)) {
        throw new Error("invalid_cron_field");
      }
      if (value >= min && value <= max) {
        values.add(value);
      }
    }

    return (value: number) => values.has(value);
  }

  private parseTimeOfDay(value: string): [number, number] {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      throw new Error("invalid_time_of_day");
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      throw new Error("invalid_time_of_day");
    }

    return [hour, minute];
  }

  private getZonedParts(date: Date, timeZone: string): ZonedParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });

    const parts = formatter.formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const part of parts) {
      lookup[part.type] = part.value;
    }

    return {
      year: Number(lookup.year),
      month: Number(lookup.month),
      day: Number(lookup.day),
      hour: Number(lookup.hour),
      minute: Number(lookup.minute),
      second: Number(lookup.second),
      weekday: WEEKDAY_LOOKUP[lookup.weekday] ?? 0,
    };
  }

  private getUtcOffsetMinutes(date: Date, timeZone: string): number | null {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });

    const zonePart = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
    if (!zonePart) {
      return null;
    }

    const match = zonePart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) {
      return null;
    }

    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    return sign * ((hours * 60) + minutes);
  }

  private toLocalRunKey(timeZone: string, parts: ZonedParts): string {
    const month = String(parts.month).padStart(2, "0");
    const day = String(parts.day).padStart(2, "0");
    const hour = String(parts.hour).padStart(2, "0");
    const minute = String(parts.minute).padStart(2, "0");
    return `${timeZone}:${parts.year}-${month}-${day}T${hour}:${minute}`;
  }

  private diffDays(from: ZonedParts, to: ZonedParts): number {
    const a = Date.UTC(from.year, from.month - 1, from.day);
    const b = Date.UTC(to.year, to.month - 1, to.day);
    return Math.floor((b - a) / 86_400_000);
  }
}
