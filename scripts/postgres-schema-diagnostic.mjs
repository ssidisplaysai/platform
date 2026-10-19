const expectedColumns = [
  { column_name: "namespace", data_type: "text", udt_name: "text", is_nullable: "NO", column_default: null },
  { column_name: "schema_version", data_type: "integer", udt_name: "int4", is_nullable: "NO", column_default: null },
  { column_name: "revision", data_type: "bigint", udt_name: "int8", is_nullable: "NO", column_default: "0" },
  { column_name: "updated_at", data_type: "timestamp with time zone", udt_name: "timestamptz", is_nullable: "NO", column_default: null },
  { column_name: "data", data_type: "jsonb", udt_name: "jsonb", is_nullable: "NO", column_default: null },
];

const expectedConstraints = [
  { name: "genesis_foundation_state_data_object", type: "c", definition: "CHECK (jsonb_typeof(data) = 'object')" },
  { name: "genesis_foundation_state_pkey", type: "p", definition: "PRIMARY KEY (namespace)" },
  { name: "genesis_foundation_state_revision_nonnegative", type: "c", definition: "CHECK (revision >= 0)" },
];

const expectedIndexes = ["genesis_foundation_state_pkey"];
const expectedMigrationName = "20261009000000_foundation_state";

export const POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES = Object.freeze({
  tables: `
    SELECT 'public' AS table_schema,
           requested.table_name,
           to_regclass(format('%I.%I', 'public', requested.table_name)) IS NOT NULL AS exists,
           pg_get_userbyid(relation.relowner) AS owner
    FROM (VALUES
      ('genesis_foundation_state'),
      ('genesis_schema_migrations')
    ) AS requested(table_name)
    LEFT JOIN pg_class relation ON relation.oid = to_regclass(format('%I.%I', 'public', requested.table_name))
    ORDER BY requested.table_name
  `,
  database: "SELECT current_database() AS database, current_user AS username",
  columns: `
    SELECT ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'genesis_foundation_state'
    ORDER BY ordinal_position
  `,
  primaryKey: `
    SELECT constraint_row.conname AS constraint_name,
           array_agg(attribute.attname ORDER BY key_column.ordinality) AS columns
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
    JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid AND attribute.attnum = key_column.attnum
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'genesis_foundation_state'
      AND constraint_row.contype = 'p'
    GROUP BY constraint_row.conname
    ORDER BY constraint_row.conname
  `,
  indexes: `
    SELECT index_row.indexname AS index_name,
           index_row.indexdef AS index_definition,
           index_meta.indisprimary AS is_primary,
           index_meta.indisunique AS is_unique
    FROM pg_indexes index_row
    JOIN pg_class relation ON relation.oid = format('%I.%I', index_row.schemaname, index_row.indexname)::regclass
    JOIN pg_index index_meta ON index_meta.indexrelid = relation.oid
    WHERE index_row.schemaname = 'public' AND index_row.tablename = 'genesis_foundation_state'
    ORDER BY index_row.indexname
  `,
  constraints: `
    SELECT constraint_row.conname AS constraint_name,
           constraint_row.contype AS constraint_type,
           pg_get_constraintdef(constraint_row.oid, true) AS definition
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = 'genesis_foundation_state'
    ORDER BY constraint_row.conname
  `,
  migration: `
    SELECT jsonb_strip_nulls(jsonb_build_object(
             'id', to_jsonb(migration_row)->'id',
             'name', to_jsonb(migration_row)->'name',
             'run_on', to_jsonb(migration_row)->'run_on',
             'run_order', to_jsonb(migration_row)->'run_order',
             'migration_id', to_jsonb(migration_row)->'migration_id'
           )) AS migration_row,
           count(*) OVER ()::integer AS returned_row_count
    FROM public.genesis_schema_migrations AS migration_row
    WHERE to_jsonb(migration_row)->>'name' = $1
       OR migration_row.id IN (
         SELECT recent_migration.id
         FROM public.genesis_schema_migrations AS recent_migration
         ORDER BY recent_migration.id DESC
         LIMIT 999
       )
    ORDER BY migration_row.id
    LIMIT 1000
  `,
  migrationColumns: `
    SELECT ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'genesis_schema_migrations'
    ORDER BY ordinal_position
  `,
});

function normalizeConstraintDefinition(definition) {
  return definition
    .replaceAll("::text", "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function compareRows(expected, actual, key) {
  const expectedByKey = new Map(expected.map((row) => [row[key], row]));
  const actualByKey = new Map(actual.map((row) => [row[key], row]));
  return {
    missing: [...expectedByKey.keys()].filter((name) => !actualByKey.has(name)),
    extra: [...actualByKey.keys()].filter((name) => !expectedByKey.has(name)),
    changed: [...expectedByKey.keys()]
      .filter((name) => actualByKey.has(name) && JSON.stringify(expectedByKey.get(name)) !== JSON.stringify(actualByKey.get(name)))
      .map((name) => ({ name, expected: expectedByKey.get(name), actual: actualByKey.get(name) })),
  };
}

export function comparePostgresSchema(metadata) {
  const mismatches = [];
  const stateTable = metadata.tables?.find(({ table_name: name }) => name === "genesis_foundation_state");
  const migrationTable = metadata.tables?.find(({ table_name: name }) => name === "genesis_schema_migrations");
  if (!stateTable?.exists) {
    mismatches.push({
      classification: "M. ACTUAL_MIGRATION_DEFECT",
      object: "public.genesis_foundation_state",
      expected: "present",
      actual: "absent",
    });
    return mismatches.sort((left, right) => left.classification.localeCompare(right.classification));
  }
  if (!migrationTable?.exists) {
    mismatches.push({
      classification: "I. MIGRATION_RECORD_NAME_DIFFERENCE",
      object: "public.genesis_schema_migrations",
      expected: "present",
      actual: "absent",
    });
  }

  const columns = metadata.columns ?? [];
  const actualColumnNames = columns.map(({ column_name: name }) => name);
  const expectedColumnNames = expectedColumns.map(({ column_name: name }) => name);
  if (JSON.stringify(actualColumnNames) !== JSON.stringify(expectedColumnNames)) {
    mismatches.push({
      classification: "A. COLUMN_ORDER_DIFFERENCE",
      expected: expectedColumnNames,
      actual: actualColumnNames,
    });
  }

  for (const column of expectedColumns) {
    const actual = columns.find(({ column_name: name }) => name === column.column_name);
    if (!actual) continue;
    if (actual.data_type !== column.data_type || actual.udt_name !== column.udt_name) {
      mismatches.push({
        classification: "B. COLUMN_TYPE_DIFFERENCE",
        column: column.column_name,
        expected: { data_type: column.data_type, udt_name: column.udt_name },
        actual: { data_type: actual.data_type, udt_name: actual.udt_name },
      });
    }
    if (actual.is_nullable !== column.is_nullable) {
      mismatches.push({
        classification: "C. COLUMN_NULLABILITY_DIFFERENCE",
        column: column.column_name,
        expected: column.is_nullable,
        actual: actual.is_nullable,
      });
    }
    if (actual.column_default !== column.column_default) {
      mismatches.push({
        classification: "D. DEFAULT_EXPRESSION_DIFFERENCE",
        column: column.column_name,
        expected: column.column_default,
        actual: actual.column_default,
      });
    }
  }

  const primaryKeys = metadata.primary_key ?? [];
  if (
    primaryKeys.length !== 1
    || primaryKeys[0].constraint_name !== "genesis_foundation_state_pkey"
  ) {
    mismatches.push({
      classification: "E. PRIMARY_KEY_NAME_DIFFERENCE",
      expected: "genesis_foundation_state_pkey",
      actual: primaryKeys.map(({ constraint_name }) => constraint_name),
    });
  }
  if (
    primaryKeys.length !== 1
    || JSON.stringify(primaryKeys[0].columns) !== JSON.stringify(["namespace"])
  ) {
    mismatches.push({
      classification: "F. PRIMARY_KEY_COLUMN_DIFFERENCE",
      expected: ["namespace"],
      actual: primaryKeys,
    });
  }

  const indexes = metadata.indexes ?? [];
  const indexComparison = compareRows(
    expectedIndexes.map((index_name) => ({ index_name })),
    indexes.map(({ index_name }) => ({ index_name })),
    "index_name",
  );
  if (indexComparison.missing.length) {
    mismatches.push({
      classification: "G. INDEX_NAME_DIFFERENCE",
      expected: expectedIndexes,
      actual: indexes.map(({ index_name }) => index_name),
    });
  }
  if (indexComparison.extra.length) {
    mismatches.push({ classification: "H. EXTRA_INDEX", actual: indexComparison.extra });
  }

  const constraints = metadata.constraints ?? [];
  const constraintNames = compareRows(
    expectedConstraints.map(({ name }) => ({ name })),
    constraints.map(({ constraint_name: name }) => ({ name })),
    "name",
  );
  if (constraintNames.missing.length || constraintNames.extra.length) {
    mismatches.push({
      classification: "I. CONSTRAINT_NAME_DIFFERENCE",
      expected: expectedConstraints.map(({ name }) => name),
      actual: constraints.map(({ constraint_name: name }) => name),
    });
  }
  for (const expected of expectedConstraints) {
    const actual = constraints.find(({ constraint_name: name }) => name === expected.name);
    if (!actual) continue;
    if (
      actual.constraint_type !== expected.type
      || normalizeConstraintDefinition(actual.definition) !== normalizeConstraintDefinition(expected.definition)
    ) {
      mismatches.push({
        classification: "J. CONSTRAINT_DEFINITION_DIFFERENCE",
        constraint: expected.name,
        expected: { constraint_type: expected.type, definition: expected.definition },
        actual: { constraint_type: actual.constraint_type, definition: actual.definition },
      });
    }
  }

  const migrationRows = metadata.migration_rows ?? [];
  const matchingMigration = migrationRows.filter((row) => row?.name === expectedMigrationName);
  if (matchingMigration.length !== 1) {
    mismatches.push({
      classification: "K. MIGRATION_RECORD_DIFFERENCE",
      expected: { name: expectedMigrationName, row_count: 1 },
      actual: migrationRows,
    });
  }

  return mismatches.sort((left, right) => left.classification.localeCompare(right.classification));
}

export async function collectPostgresSchemaMetadata(pool) {
  const database = (await pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.database)).rows[0]?.database;
  const tables = (await pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.tables)).rows;
  const stateTable = tables.find(({ table_name: name }) => name === "genesis_foundation_state");
  const stateTablePresent = Boolean(stateTable?.exists);
  const [columns, primaryKey, indexes, constraints] = stateTablePresent
    ? await Promise.all([
      pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.columns),
      pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.primaryKey),
      pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.indexes),
      pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.constraints),
    ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }];
  const migrationTablePresent = tables.some(
    ({ table_name: name, exists }) => name === "genesis_schema_migrations" && exists,
  );
  const migrationRows = migrationTablePresent
    ? await pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.migration, [expectedMigrationName])
    : { rows: [] };
  const migrationColumns = migrationTablePresent
    ? await pool.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.migrationColumns)
    : { rows: [] };

  return {
    database,
    tables,
    columns: columns.rows,
    primary_key: primaryKey.rows,
    indexes: indexes.rows,
    constraints: constraints.rows,
    migration_rows: migrationRows.rows.map(({ migration_row: row }) => row),
    migration_rows_returned: migrationRows.rows[0]?.returned_row_count ?? 0,
    migration_rows_truncated: (migrationRows.rows[0]?.returned_row_count ?? 0) >= 1000,
    migration_columns: migrationColumns.rows,
    migration_table_present: migrationTablePresent,
  };
}

export async function diagnosePostgresSchemaReadOnly(pool, emit = console.log) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    const result = await client.query("SELECT current_setting('transaction_read_only') AS transaction_read_only");
    if (result.rows[0]?.transaction_read_only !== "on") {
      throw new Error("PostgreSQL did not confirm a read-only diagnostic transaction.");
    }
    emit("POSTGRES_DIAGNOSTIC_READ_ONLY=PASS");
    const identity = (await client.query(POSTGRES_SCHEMA_DIAGNOSTIC_QUERIES.database)).rows[0];
    if (identity?.database !== "genesis_staging" || identity?.username !== "genesis_admin") {
      throw new Error("PostgreSQL diagnostic connection identity does not match the approved staging target.");
    }
    const metadata = await collectPostgresSchemaMetadata(client);
    return {
      metadata,
      verifierProjection: {
        database: metadata.database,
        database_matches: metadata.database === "genesis_staging",
        table_exists: metadata.tables.some(
          ({ table_name, exists }) => table_name === "genesis_foundation_state" && exists,
        ),
        columns: metadata.columns.map(({ column_name }) => column_name),
        primary_key: metadata.primary_key.flatMap(({ columns }) => columns),
        indexes: metadata.indexes.map(({ index_name }) => index_name).sort(),
        constraints: metadata.constraints.map(({ constraint_name }) => constraint_name).sort(),
      },
      mismatches: comparePostgresSchema(metadata),
    };
  } finally {
    try {
      if (transactionStarted) await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
