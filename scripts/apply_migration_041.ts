import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 041...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '041_production_notices_marks_and_scoping.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 041...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 041 executed and committed successfully!');

    // Verification of new table notices
    const tableRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'notices'
      ORDER BY ordinal_position;
    `);
    console.log('📋 Verified notices table columns:');
    tableRes.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`));

    // Verification of publication
    const pubRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'notices';
    `);
    console.log('📡 Verified notices in supabase_realtime publication:', pubRes.rows.length > 0 ? 'YES' : 'NO');

    // Verification of new RPCs
    const funcRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('publish_notice', 'delete_notice', 'publish_assessment_marks')
      ORDER BY proname;
    `);
    console.log('🔧 Verified database functions:');
    funcRes.rows.forEach(r => console.log(`   - ${r.proname} (SECURITY DEFINER: ${r.prosecdef})`));

  } catch (err: any) {
    console.error('❌ Migration 041 Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
