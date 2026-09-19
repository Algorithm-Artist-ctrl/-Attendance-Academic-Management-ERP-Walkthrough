import fs from "fs";
import path from "path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

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

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "031_performance_optimization_and_atomic_rpc.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 031 (Performance Optimization & Atomic Attendance RPC)...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 031 applied successfully.");

    // Verify indexes
    const indexesRes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_sessional_assessments_sec_sub',
          'idx_attendance_sessions_sec_date',
          'idx_assignments_section_active',
          'idx_quizzes_section_active',
          'idx_group_messages_group_created',
          'idx_messages_conversation_created'
        )
      ORDER BY tablename, indexname;
    `);
    console.log("Verified indexes:", indexesRes.rows);

    // Verify function
    const funcRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname = 'save_attendance_session';
    `);
    console.log("Verified function:", funcRes.rows);

  } finally {
    try {
      await client.end();
      console.log("Database connection closed cleanly.");
    } catch (closeErr) {
      console.error("Error closing connection:", closeErr);
    }
  }
}

main().catch(err => {
  console.error("Migration 031 execution error:", err);
  process.exit(1);
});
