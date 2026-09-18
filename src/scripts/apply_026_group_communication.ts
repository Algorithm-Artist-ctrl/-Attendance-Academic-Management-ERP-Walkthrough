import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function applyMigration026() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '026_class_group_communication_and_student_profiles.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Migration 026 (Class Group Communication & Student Profile View)...');
    await client.query(sql);
    console.log('Migration 026 executed successfully!');

    // Verify created tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('message_groups', 'group_messages', 'group_member_read_state');
    `);
    console.log('Verified tables in PostgreSQL:');
    console.table(tablesRes.rows);

    // Verify created RPC functions
    const rpcRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('send_group_message', 'mark_group_as_read', 'get_group_members', 'get_student_profile');
    `);
    console.log('Verified RPC functions:');
    console.table(rpcRes.rows);

    // Verify initial message groups count
    const groupsCount = await client.query(`SELECT count(*) FROM public.message_groups;`);
    console.log(`Initial message groups seeded: ${groupsCount.rows[0].count}`);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration026();
