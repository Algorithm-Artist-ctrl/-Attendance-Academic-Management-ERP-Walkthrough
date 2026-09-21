if (!process.env.DATABASE_URL && (process as any).loadEnvFile) {
  try { (process as any).loadEnvFile(); } catch {}
}
import fs from "fs";
import path from "path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || '';

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "023_communication_center.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 023 (Communication Center)...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 023 applied successfully.");

    // Verification of tables, RLS, and functions
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('conversations', 'messages')
      ORDER BY table_name;
    `);
    console.log("Verified tables:", tablesRes.rows.map(r => r.table_name));

    const funcsRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('get_or_create_conversation', 'send_message', 'mark_conversation_read', 'update_conversation_status')
      ORDER BY proname;
    `);
    for (const row of funcsRes.rows) {
      console.log(`Verified database function: ${row.proname} (SECURITY DEFINER: ${row.prosecdef})`);
    }

    const realtimeRes = await client.query(`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename IN ('conversations', 'messages')
      ORDER BY tablename;
    `);
    console.log("Verified realtime publication tables:", realtimeRes.rows.map(r => r.tablename));

  } finally {
    try {
      await client.end();
      console.log("Database connection closed cleanly.");
    } catch (closeErr) {
      console.error("Error closing connection:", closeErr);
    }
  }
}

main().catch((err) => {
  console.error("Migration 023 failed:", err);
  process.exit(1);
});
