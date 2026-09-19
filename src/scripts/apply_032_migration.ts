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

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "032_strict_student_marks_publication_security.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 032 (Strict Student Marks Publication Security & RLS)...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 032 applied successfully.");

    // Verify sessional_marks columns
    const marksColsRes = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessional_marks' AND column_name = 'status';
    `);
    console.log("Verified sessional_marks.status column:", marksColsRes.rows);

    // Verify assessment default
    const assColsRes = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessional_assessments' AND column_name = 'status';
    `);
    console.log("Verified sessional_assessments.status column default:", assColsRes.rows);

    // Verify statuses count
    const assCounts = await client.query(`SELECT status, count(*) FROM sessional_assessments GROUP BY status;`);
    console.log("Assessment status counts:", assCounts.rows);

    const marksCounts = await client.query(`SELECT status, count(*) FROM sessional_marks GROUP BY status;`);
    console.log("Marks status counts:", marksCounts.rows);

    // Verify policies
    const polRes = await client.query(`
      SELECT policyname, tablename, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('sessional_marks', 'sessional_assessments')
      ORDER BY tablename, policyname;
    `);
    console.log("Verified policies:", polRes.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration 032 failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
      console.log("Database connection closed cleanly.");
    } catch (closeErr) {
      console.warn("Failed to close DB connection:", closeErr);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
