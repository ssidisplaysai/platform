import { randomUUID } from "node:crypto";
import type { Clock } from "./Clock";
import type { ScheduleClaimStore } from "../persistence";
import type { ScheduleClaimRecord } from "../persistence";

export type ClaimResult = {
  claimed: boolean;
  claim?: ScheduleClaimRecord;
  reason?: "ALREADY_CLAIMED" | "CONFLICT";
};

export class OccurrenceClaimService {
  constructor(
    private readonly claimStore: ScheduleClaimStore,
    private readonly clock: Clock,
    private readonly claimTtlMs = 30_000,
  ) {}

  async claim(input: { occurrenceId: string; owner: string; idempotencyKey: string; logicalRunKey?: string }): Promise<ClaimResult> {
    const now = this.clock.now();

    if (this.claimStore.claimAtomic) {
      const atomic = await this.claimStore.claimAtomic({
        occurrenceId: input.occurrenceId,
        owner: input.owner,
        idempotencyKey: input.idempotencyKey,
        logicalRunKey: input.logicalRunKey,
        claimId: randomUUID(),
        claimedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + this.claimTtlMs).toISOString(),
      });
      return atomic;
    }

    const existing = await this.claimStore.getByOccurrenceId(input.occurrenceId);

    if (existing) {
      if (this.isExpired(existing, now) && existing.status === "CLAIMED") {
        await this.expire(existing);
      } else if (existing.idempotencyKey === input.idempotencyKey) {
        return { claimed: false, reason: "ALREADY_CLAIMED", claim: existing };
      } else if (existing.status === "CLAIMED") {
        return { claimed: false, reason: "CONFLICT", claim: existing };
      }
    }

    const claim: ScheduleClaimRecord = {
      claimId: randomUUID(),
      occurrenceId: input.occurrenceId,
      idempotencyKey: input.idempotencyKey,
      logicalRunKey: input.logicalRunKey,
      status: "CLAIMED",
      claimedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.claimTtlMs).toISOString(),
      owner: input.owner,
    };

    await this.claimStore.upsert(claim);
    return { claimed: true, claim };
  }

  async markCompleted(occurrenceId: string): Promise<void> {
    const current = await this.claimStore.getByOccurrenceId(occurrenceId);
    if (!current) {
      return;
    }

    await this.claimStore.upsert({ ...current, status: "COMPLETED", expiresAt: this.clock.nowIso() });
  }

  async markFailed(occurrenceId: string, reason: string): Promise<void> {
    const current = await this.claimStore.getByOccurrenceId(occurrenceId);
    if (!current) {
      return;
    }

    await this.claimStore.upsert({ ...current, status: "FAILED", failureReason: reason, expiresAt: this.clock.nowIso() });
  }

  async recoverExpiredClaims(): Promise<number> {
    const now = this.clock.now();
    const all = await this.claimStore.list();
    let recovered = 0;

    for (const claim of all) {
      if (claim.status === "CLAIMED" && this.isExpired(claim, now)) {
        await this.expire(claim);
        recovered += 1;
      }
    }

    return recovered;
  }

  private async expire(claim: ScheduleClaimRecord): Promise<void> {
    await this.claimStore.upsert({
      ...claim,
      status: "EXPIRED",
      expiresAt: this.clock.nowIso(),
    });
  }

  private isExpired(claim: ScheduleClaimRecord, now: Date): boolean {
    return new Date(claim.expiresAt).getTime() <= now.getTime();
  }
}
