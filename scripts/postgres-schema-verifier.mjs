const expectedColumns = [
  { column_name: "namespace", data_type: "text", udt_name: "text", is_nullable: "NO", column_default: null },
  { column_name: "schema_version", data_type: "integer", udt_name: "int4", is_nullable: "NO", column_default: null },
  { column_name: "revision", data_type: "bigint", udt_name: "int8", is_nullable: "NO", column_default: "0" },
  { column_name: "updated_at", data_type: "timestamp with time zone", udt_name: "timestamptz", is_nullable: "NO", column_default: null },
  { column_name: "data", data_type: "jsonb", udt_name: "jsonb", is_nullable: "NO", column_default: null },
];

const expectedPrimaryKey = {
  constraint_name: "genesis_foundation_state_pkey",
  columns: ["namespace"],
};

const expectedIndexes = [{
  index_name: "genesis_foundation_state_pkey",
  is_primary: true,
  is_unique: true,
}];

const expectedConstraints = [
  {
    constraint_name: "genesis_foundation_state_data_object",
    constraint_type: "c",
    definition: "CHECK (jsonb_typeof(data) = 'object')",
  },
  {
    constraint_name: "genesis_foundation_state_pkey",
    constraint_type: "p",
    definition: "PRIMARY KEY (namespace)",
  },
  {
    constraint_name: "genesis_foundation_state_revision_nonnegative",
    constraint_type: "c",
    definition: "CHECK (revision >= 0)",
  },
];

const expectedMigrations = [
  "20261009000000_foundation_state",
  "20261010204600_add_foundation_state_constraints",
];

export const FOUNDATION_SCHEMA_VERIFICATION_QUERY = `
  SELECT
    current_database() AS database,
    current_user AS username,
    to_regclass('public.genesis_foundation_state') IS NOT NULL AS table_exists,
    (
      SELECT pg_get_userbyid(relation.relowner)
      FROM pg_class relation
      JOIN pg_namespace schema_row ON schema_row.oid = relation.relnamespace
      WHERE schema_row.nspname = 'public' AND relation.relname = 'genesis_foundation_state'
    ) AS table_owner,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'column_name', column_name::text,
        'data_type', data_type,
        'udt_name', udt_name::text,
        'is_nullable', is_nullable,
        'column_default', column_default
      ) ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'genesis_foundation_state'
    ) AS columns,
    (
      SELECT jsonb_build_object(
        'constraint_name', constraint_row.conname::text,
        'columns', array_agg(attribute.attname::text ORDER BY key_column.ordinality)
      )
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace schema_row ON schema_row.oid = relation.relnamespace
      CROSS JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
      JOIN pg_attribute attribute
        ON attribute.attrelid = relation.oid AND attribute.attnum = key_column.attnum
      WHERE schema_row.nspname = 'public'
        AND relation.relname = 'genesis_foundation_state'
        AND constraint_row.contype = 'p'
      GROUP BY constraint_row.conname
    ) AS primary_key,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'index_name', index_row.indexname::text,
        'is_primary', index_meta.indisprimary,
        'is_unique', index_meta.indisunique
      ) ORDER BY index_row.indexname)
      FROM pg_indexes index_row
      JOIN pg_class index_relation
        ON index_relation.oid = format('%I.%I', index_row.schemaname, index_row.indexname)::regclass
      JOIN pg_index index_meta ON index_meta.indexrelid = index_relation.oid
      WHERE index_row.schemaname = 'public'
        AND index_row.tablename = 'genesis_foundation_state'
    ) AS indexes,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'constraint_name', constraint_row.conname::text,
        'constraint_type', constraint_row.contype::text,
        'definition', pg_get_constraintdef(constraint_row.oid, true)
      ) ORDER BY constraint_row.conname)
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace schema_row ON schema_row.oid = relation.relnamespace
      WHERE schema_row.nspname = 'public'
        AND relation.relname = 'genesis_foundation_state'
    ) AS constraints
`;

export const FOUNDATION_MIGRATION_VERIFICATION_QUERY = `
  SELECT name::text AS name, id, run_on
  FROM public.genesis_schema_migrations
  WHERE name = ANY($1::text[])
  ORDER BY name
`;

function normalizeConstraintDefinition(definition) {
  return definition.replaceAll("::text", "").replace(/\s+/g, "").toLowerCase();
}

function sameJson(actual, expected) {
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(canonicalize(actual)) === JSON.stringify(canonicalize(expected));
}

export function compareFoundationSchema(row, migrations, expectedDatabase, expectedUsername) {
  const mismatches = [];
  const migrationNames = migrations.map(({ name }) => name).sort();

  if (row?.database !== expectedDatabase) mismatches.push("database");
  if (row?.username !== expectedUsername) mismatches.push("username");
  if (row?.table_exists !== true) mismatches.push("table_exists");
  if (row?.table_owner !== "genesis_app") mismatches.push("table_owner");
  if (!sameJson(row?.columns, expectedColumns)) mismatches.push("columns");

  const primaryKey = row?.primary_key;
  if (
    primaryKey?.constraint_name !== expectedPrimaryKey.constraint_name
    || !sameJson(primaryKey?.columns, expectedPrimaryKey.columns)
  ) {
    mismatches.push("primary_key");
  }

  if (!sameJson(row?.indexes, expectedIndexes)) mismatches.push("indexes");

  const constraints = row?.constraints ?? [];
  if (
    constraints.length !== expectedConstraints.length
    || expectedConstraints.some((expected) => {
      const actual = constraints.find(({ constraint_name: name }) => name === expected.constraint_name);
      return !actual
        || actual.constraint_type !== expected.constraint_type
        || normalizeConstraintDefinition(actual.definition) !== normalizeConstraintDefinition(expected.definition);
    })
  ) {
    mismatches.push("constraints");
  }

  if (!sameJson(migrationNames, expectedMigrations)) mismatches.push("migrations");
  return mismatches;
}

export async function verifyFoundationSchema(client, expectedDatabase, expectedUsername) {
  const schemaResult = await client.query(FOUNDATION_SCHEMA_VERIFICATION_QUERY);
  const migrationResult = await client.query(
    FOUNDATION_MIGRATION_VERIFICATION_QUERY,
    [expectedMigrations],
  );
  const mismatches = compareFoundationSchema(
    schemaResult.rows[0],
    migrationResult.rows,
    expectedDatabase,
    expectedUsername,
  );
  if (mismatches.length) {
    throw new Error(`Foundation state schema verification failed: ${mismatches.join(", ")}.`);
  }
  return schemaResult.rows[0];
}
