if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';

async function applyMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database for Migration 040...');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '040_stabilize_group_messages_and_chat_controls.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 040...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 040 executed and committed successfully!');

    // Verification of new columns on group_messages
    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'group_messages'
      ORDER BY ordinal_position;
    `);
    console.log('📋 Verified group_messages columns:', colRes.rows.map(r => r.column_name));

    // Verification of new RPCs
    const funcRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('edit_group_message', 'delete_group_message', 'clear_group_chat_for_me', 'delete_group_message_for_me', 'send_group_message')
      ORDER BY proname;
    `);
    console.log('🔧 Verified database functions:');
    funcRes.rows.forEach(r => console.log(`   - ${r.proname} (SECURITY DEFINER: ${r.prosecdef})`));

  } catch (err: any) {
    console.error('❌ Migration 040 Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
