import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function applyMigration() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database...');

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

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '039_premium_messaging_and_chat_controls.sql');
    console.log(`📦 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing Migration 039...');
    await client.query(sql);
    console.log('✅ Migration 039 applied successfully!');
  } catch (err: any) {
    console.error('❌ Migration 039 Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
