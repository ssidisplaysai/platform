export const FOUNDATION_STATE_COLLECTIONS = Object.freeze([
  "participants",
  "trackingIdentities",
  "ruleVersions",
  "ledgerEntries",
  "sourceEventReceipts",
  "processedCommerceLines",
  "payoutEntitlements",
  "commerceAdjustments",
]);

const canonicalIdFields = Object.freeze({
  participants: ["participantId"],
  trackingIdentities: ["trackingIdentityId"],
  ruleVersions: ["id"],
  ledgerEntries: ["id", "idempotencyKey"],
  sourceEventReceipts: ["sourceEventId"],
  processedCommerceLines: ["lineKey"],
  payoutEntitlements: ["entitlementId", "ledgerEntryId"],
  commerceAdjustments: ["adjustmentId"],
});

export function validateFoundationStateEnvelope(envelope) {
  if (
    envelope === null
    || typeof envelope !== "object"
    || Array.isArray(envelope)
    || envelope.schemaVersion !== 1
    || !Number.isSafeInteger(envelope.revision)
    || envelope.revision < 0
    || typeof envelope.updatedAt !== "string"
    || Number.isNaN(Date.parse(envelope.updatedAt))
    || envelope.data === null
    || typeof envelope.data !== "object"
    || Array.isArray(envelope.data)
  ) {
    throw new Error("Source state envelope has an unsupported schema or invalid metadata.");
  }

  if (FOUNDATION_STATE_COLLECTIONS.some((key) => !Array.isArray(envelope.data[key]))) {
    throw new Error("Source Share-to-Grow state is missing one or more required collections.");
  }

  const counts = Object.fromEntries(FOUNDATION_STATE_COLLECTIONS.map((key) => [
    key,
    envelope.data[key].length,
  ]));
  for (const [collection, fields] of Object.entries(canonicalIdFields)) {
    const identifiers = new Map(fields.map((field) => [field, new Set()]));
    for (const record of envelope.data[collection]) {
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        throw new Error(`Source collection ${collection} contains a malformed record.`);
      }
      for (const field of fields) {
        const identifier = record[field];
        if (typeof identifier !== "string" || identifier.trim() === "") {
          throw new Error(`Source collection ${collection} contains a record without ${field}.`);
        }
        const values = identifiers.get(field);
        if (values.has(identifier)) {
          throw new Error(`Source collection ${collection} contains duplicate ${field} values.`);
        }
        values.add(identifier);
      }
    }
  }
  return counts;
}
