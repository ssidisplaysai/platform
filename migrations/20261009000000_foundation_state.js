exports.up = (pgm) => {
  pgm.createTable("genesis_foundation_state", {
    namespace: { type: "text", primaryKey: true, notNull: true },
    schema_version: { type: "integer", notNull: true },
    revision: { type: "bigint", notNull: true, default: 0 },
    updated_at: { type: "timestamptz", notNull: true },
    data: { type: "jsonb", notNull: true },
  }, {
    constraints: {
      genesis_foundation_state_revision_nonnegative: "CHECK (revision >= 0)",
      genesis_foundation_state_data_object: "CHECK (jsonb_typeof(data) = 'object')",
    },
  });
};

exports.down = () => {
  throw new Error(
    "The foundation state table contains financial ledger state; restore from a verified backup instead of dropping it.",
  );
};
