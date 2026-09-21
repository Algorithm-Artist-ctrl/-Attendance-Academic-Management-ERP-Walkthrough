if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function applyMigration() {
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 043...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '043_comprehensive_security_hardening.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 043...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 043 executed and committed successfully!');

    // Verify triggers
    const triggerRes = await client.query(`
      SELECT tgname, relname 
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE tgname IN ('trg_prevent_profile_role_escalation', 'trg_prevent_student_academic_manipulation');
    `);

    console.log('📋 Verified Triggers:');
    triggerRes.rows.forEach(r => console.log(`   - [${r.relname}] ${r.tgname}`));

    // Verify policies
    const policyRes = await client.query(`
      SELECT tablename, policyname, roles, cmd 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND policyname IN ('profiles_read', 'attendance_sessions_write', 'leave_applications_select_policy');
    `);

    console.log('📋 Verified Hardened Policies:');
    policyRes.rows.forEach(r => console.log(`   - [${r.tablename}] ${r.policyname} (${r.cmd}) -> ${r.roles}`));

    console.log('🎉 Migration 043 applied and verified successfully!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err);
    try {
      await client.query('ROLLBACK');
    } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
