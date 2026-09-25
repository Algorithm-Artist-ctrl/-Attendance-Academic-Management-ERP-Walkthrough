if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '053_role_scoped_email_notifications_and_delivery_tracking.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying Migration 053: Role-Scoped Email Notification Delivery...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 053 applied successfully.');

    // Verification
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name LIKE 'email_%'
      ORDER BY column_name;
    `);
    console.log('Verified notifications email columns:');
    console.table(colsRes.rows);

    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'notification_email_deliveries';
    `);
    console.log('Verified notification_email_deliveries table:', tblRes.rows[0]?.table_name);

    const funcRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('get_notifications_for_email_delivery', 'record_notification_email_delivery');
    `);
    console.log('Verified RPC functions:');
    console.table(funcRes.rows);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to apply migration 053:', err);
    throw err;
  } finally {
    await client.end().catch(() => {});
    console.log('Database connection closed.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
