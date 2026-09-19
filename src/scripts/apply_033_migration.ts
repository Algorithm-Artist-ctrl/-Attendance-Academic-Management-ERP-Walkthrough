import fs from "fs";
import path from "path";
import pg from "pg";

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "033_advanced_records_and_archive_system.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 033 (Advanced Institutional Records & Archive System)...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 033 applied successfully.");

    // Verify account_lifecycle table
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'account_lifecycle';
    `);
    console.log("Verified account_lifecycle table exists:", tableRes.rows);

    // Verify lifecycle columns on students
    const studentColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'students' AND column_name IN ('exit_date', 'exit_reason', 'archived_at', 'archived_by');
    `);
    console.log("Verified students lifecycle columns:", studentColsRes.rows);

    // Verify lifecycle columns on faculty
    const facultyColsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'faculty' AND column_name IN ('exit_date', 'exit_reason', 'archived_at', 'archived_by');
    `);
    console.log("Verified faculty lifecycle columns:", facultyColsRes.rows);

    // Verify get_archived_stats RPC
    const statsRes = await client.query(`SELECT public.get_archived_stats() as stats;`);
    console.log("Live archived stats:", statsRes.rows[0]?.stats);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Migration 033 failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
