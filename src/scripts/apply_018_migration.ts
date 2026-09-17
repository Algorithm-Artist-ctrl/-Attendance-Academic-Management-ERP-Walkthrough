import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  console.log('--- Applying Migration 018: Atomic Attendance Claim and Review ---');
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '018_atomic_attendance_claim_and_review.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL pooler.');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 018 applied successfully!');

    // Verify functions exist
    const res = await client.query(`
      SELECT proname, proargnames 
      FROM pg_proc 
      WHERE proname IN ('claim_attendance', 'approve_attendance_claim', 'reject_attendance_claim')
    `);
    console.log('Installed RPC functions:');
    res.rows.forEach(r => {
      console.log(` - ${r.proname}(${r.proargnames?.join(', ') || ''})`);
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 018 failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
