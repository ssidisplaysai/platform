import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EconomicRuleVersion } from "../economic-rule";
import { money } from "../money";
import {
  listCollaborationParticipants,
  listEconomicRuleVersions,
  listPersistedLedgerEntries,
  listTrackingIdentityReferences,
  postPersistedLedgerEntry,
  registerCollaborationParticipant,
  registerEconomicRuleVersion,
  registerTrackingIdentityReference,
  reloadShareToGrowRepositoryFromPersistence,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

describe("Share-to-Grow durable repository", () => {
  let persistenceRoot: string;

  beforeEach(() => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "share-to-grow-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = persistenceRoot;
    resetShareToGrowRepositoryForTests();
  });

  afterEach(() => {
    delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("persists collaboration participant and canonical Partner reference", () => {
    registerCollaborationParticipant({
      participantId: "participant-daniel",
      organizationId: "stoner",
      collaborationId: "stoner-gym",
      canonicalPartnerId: "partner-daniel",
      role: "founding_collaborator",
      status: "active",
      createdAt: "2026-10-05T00:00:00Z",
    });

    reloadShareToGrowRepositoryFromPersistence();

    expect(listCollaborationParticipants()).toHaveLength(1);
    expect(listCollaborationParticipants()[0].canonicalPartnerId).toBe("partner-daniel");
  });

  test("references existing canonical PartnerQRCode instead of duplicating QR entity", () => {
    registerTrackingIdentityReference({
      trackingIdentityId: "tracking-daniel",
      organizationId: "stoner",
      canonicalPartnerId: "partner-daniel",
      canonicalPartnerQrId: "qr-daniel",
      publicSlug: "daniel",
      status: "active",
      createdAt: "2026-10-05T00:00:00Z",
    });

    reloadShareToGrowRepositoryFromPersistence();

    expect(listTrackingIdentityReferences()[0].canonicalPartnerQrId).toBe("qr-daniel");
  });

  test("economic rule versions remain durable and immutable by identity", () => {
    const rule: EconomicRuleVersion = Object.freeze({
      id: "rule-version-direct-v1",
      ruleId: "direct",
      version: 1,
      effectiveFrom: "2026-10-05T00:00:00Z",
      residualBeneficiaryId: "stoner",
      beneficiaries: Object.freeze([
        Object.freeze({ beneficiaryId: "stoner", role: "brand", basisPoints: 5000 }),
        Object.freeze({ beneficiaryId: "daniel", role: "founding_collaborator", basisPoints: 5000 }),
      ]),
    });

    registerEconomicRuleVersion(rule);
    reloadShareToGrowRepositoryFromPersistence();

    expect(listEconomicRuleVersions()).toHaveLength(1);
    expect(listEconomicRuleVersions()[0].version).toBe(1);
  });

  test("persists bigint money as exact decimal minor-unit text", () => {
    postPersistedLedgerEntry({
      id: "entry-1",
      idempotencyKey: "order-1:line-1:daniel:v1",
      beneficiaryId: "daniel",
      allocationId: "allocation-1",
      entryType: "earning",
      amount: money(BigInt("900719925474099300")),
      postedAt: "2026-10-05T00:00:00Z",
    });

    reloadShareToGrowRepositoryFromPersistence();

    expect(listPersistedLedgerEntries()[0].amountMinor).toBe("900719925474099300");
  });

  test("replayed idempotency key does not create duplicate ledger effect", () => {
    const entry = {
      id: "entry-1",
      idempotencyKey: "order-1:line-1:stoner:v1",
      beneficiaryId: "stoner",
      entryType: "earning" as const,
      amount: money(1850),
      postedAt: "2026-10-05T00:00:00Z",
    };
    postPersistedLedgerEntry(entry);
    postPersistedLedgerEntry({ ...entry, id: "entry-replay" });

    expect(listPersistedLedgerEntries()).toHaveLength(1);
  });

  test("blocks compensated creator beneath another creator", () => {
    registerCollaborationParticipant({
      participantId: "creator-a",
      organizationId: "stoner",
      collaborationId: "stoner-gym",
      canonicalPartnerId: "partner-creator-a",
      role: "creator",
      sponsorPartnerId: "partner-daniel",
      status: "active",
      createdAt: "2026-10-05T00:00:00Z",
    });

    expect(() =>
      registerCollaborationParticipant({
        participantId: "creator-b",
        organizationId: "stoner",
        collaborationId: "stoner-gym",
        canonicalPartnerId: "partner-creator-b",
        role: "creator",
        sponsorPartnerId: "partner-creator-a",
        status: "active",
        createdAt: "2026-10-05T00:00:00Z",
      }),
    ).toThrow("CREATOR_DOWNLINE_DEPTH_EXCEEDED");
  });
});
