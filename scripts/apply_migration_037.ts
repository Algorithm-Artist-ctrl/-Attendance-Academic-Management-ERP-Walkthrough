import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function applyMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database via Connection String...');

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:[DB_PASSWORD]@[DB_HOST]:5432/postgres';

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '037_attendance_claim_notifications_and_faculty_scoping.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 037...');
    await client.query(sql);
    console.log('✅ Migration 037 applied successfully!');

    // Verification
    const resCol = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipient_faculty_id';
    `);
    console.log('Verification notifications.recipient_faculty_id column:', resCol.rows);

    const resTrg = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_name IN ('trg_notify_faculty_on_claim', 'trg_notify_student_on_review');
    `);
    console.log('Verification triggers:', resTrg.rows);

  } catch (err: any) {
    console.error('❌ Migration 037 Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
