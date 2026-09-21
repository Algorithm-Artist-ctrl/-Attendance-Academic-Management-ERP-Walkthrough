if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function applyMigration() {
  console.log('--- Applying Migration 019: Student Notifications & Supabase Realtime Engine ---');
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '019_student_notifications_and_realtime.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL pooler.');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 019 applied successfully!');

    // Verify table and publication
    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'notifications';
    `);
    console.log('Table verification:', tblRes.rows);

    const pubRes = await client.query(`
      SELECT pubname, schemaname, tablename 
      FROM pg_publication_tables 
      WHERE tablename = 'notifications';
    `);
    console.log('Publication verification:', pubRes.rows);

    const procRes = await client.query(`
      SELECT proname, proargnames 
      FROM pg_proc 
      WHERE proname IN ('mark_notification_as_read', 'mark_all_notifications_as_read');
    `);
    console.log('RPC verification:', procRes.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 019 failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
