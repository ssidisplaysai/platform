const table = { schema: "public", name: "genesis_foundation_state" };
const expectedConstraints = new Map([
  ["genesis_foundation_state_data_object", "CHECK (jsonb_typeof(data) = 'object')"],
  ["genesis_foundation_state_revision_nonnegative", "CHECK (revision >= 0)"],
]);

exports.up = async (pgm) => {
  const invalidRows = await pgm.db.query(`
    SELECT
      (SELECT count(*) FROM public.genesis_foundation_state WHERE revision < 0) AS negative_revisions,
      (SELECT count(*) FROM public.genesis_foundation_state
       WHERE jsonb_typeof(data) IS DISTINCT FROM 'object') AS non_object_data
  `);
  const counts = invalidRows.rows[0];
  if (BigInt(counts.negative_revisions) !== 0n || BigInt(counts.non_object_data) !== 0n) {
    throw new Error(
      `Refusing to add foundation-state constraints: violating rows found `
      + `(negative revisions=${counts.negative_revisions}, non-object data=${counts.non_object_data}).`,
    );
  }

  const existingConstraints = await pgm.db.query(`
    SELECT constraint_row.conname AS name,
           pg_get_constraintdef(constraint_row.oid, true) AS definition
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.genesis_foundation_state'::regclass
  `);
  const present = new Map(existingConstraints.rows.map(({ name, definition }) => [name, definition]));
  for (const [name, definition] of expectedConstraints) {
    const existing = present.get(name);
    if (existing !== undefined && normalizeDefinition(existing) !== normalizeDefinition(definition)) {
      throw new Error(`Refusing to replace conflicting foundation-state constraint ${name}.`);
    }
    if (existing === undefined) pgm.addConstraint(table, name, definition);
  }
};

exports.down = () => {
  throw new Error(
    "Foundation state contains financial ledger state; restore from a verified backup instead of removing integrity constraints.",
  );
};

function normalizeDefinition(definition) {
  return definition.replaceAll("::text", "").replace(/\s+/g, "").toLowerCase();
}
