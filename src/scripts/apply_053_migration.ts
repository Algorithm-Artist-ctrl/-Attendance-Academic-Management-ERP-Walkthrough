import fs from 'fs';
import pg from 'pg';

let cs = process.env.DATABASE_URL || '';
if (!cs && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
    if (line.startsWith('DATABASE_URL=')) cs = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
  }
}

async function main() {
  console.log('Connecting to PostgreSQL to apply Migration 053...');
  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sql = fs.readFileSync('supabase/migrations/053_role_scoped_email_notifications_and_delivery_tracking.sql', 'utf-8');
  console.log('Applying migration SQL...');
  await client.query(sql);
  console.log('✅ Migration 053 successfully applied!');

  // Verify columns on notifications
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' AND table_schema = 'public' AND column_name IN ('email_status', 'email_sent_at', 'email_recipient', 'email_error');"
  );
  console.log('Notifications email columns:', cols.rows);

  // Verify deliveries table
  const tbl = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'notification_email_deliveries' AND table_schema = 'public';"
  );
  console.log('notification_email_deliveries exists:', tbl.rows.length > 0);

  // Verify functions
  const rpcs = await client.query(
    "SELECT proname FROM pg_proc WHERE proname IN ('get_notifications_for_email_delivery', 'record_notification_email_delivery');"
  );
  console.log('RPCs exist:', rpcs.rows.map(r => r.proname));

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
