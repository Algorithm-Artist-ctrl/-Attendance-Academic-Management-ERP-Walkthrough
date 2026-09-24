import fs from 'fs';
import path from 'path';
import pg from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL.');

  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '052_future_table_data_api_compatibility_and_conventions.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 052...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 052 applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 052 failed and rolled back:', err);
    process.exit(1);
  }

  // 1. Verification: check default ACLs on public schema
  const checkDefAcl = await client.query(`
    SELECT 
      pg_catalog.pg_get_userbyid(d.defaclrole) AS grantor,
      n.nspname AS schema_name,
      d.defaclobjtype AS object_type,
      d.defaclacl AS acl
    FROM pg_catalog.pg_default_acl d
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname = 'public'
    ORDER BY grantor, d.defaclobjtype;
  `);
  console.log('\nVerified Default ACLs in public schema:');
  console.table(checkDefAcl.rows);

  // 2. Verification: confirm all 41 public tables have RLS enabled
  const checkRls = await client.query(`
    SELECT 
      count(*) AS total_tables,
      count(*) FILTER (WHERE c.relrowsecurity = true) AS rls_secured_tables,
      count(*) FILTER (WHERE c.relrowsecurity = false) AS unsecure_tables
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r';
  `);
  console.log('\nVerified Public Tables RLS Coverage:');
  console.table(checkRls.rows);

  // 3. Verification: confirm schema documentation comment
  const checkComment = await client.query(`
    SELECT obj_description(oid, 'pg_namespace') AS schema_comment
    FROM pg_namespace
    WHERE nspname = 'public';
  `);
  console.log('\nVerified Schema Comment:');
  console.log(checkComment.rows[0]?.schema_comment);

  await client.end();
}

main().catch(console.error);
