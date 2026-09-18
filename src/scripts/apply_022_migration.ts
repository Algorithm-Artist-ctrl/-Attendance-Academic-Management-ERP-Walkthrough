import fs from "fs";
import path from "path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.obssoojzryqiudllnlkh:Tarun%40759977@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "022_prevent_auto_password_changes.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 022...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 022 applied successfully.");

    // Verification of procedure existence
    const funcsRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('admin_update_account_credentials', 'reconcile_all_accounts')
      ORDER BY proname;
    `);

    for (const row of funcsRes.rows) {
      console.log(`Verified database function: ${row.proname} (SECURITY DEFINER: ${row.prosecdef})`);
    }
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
  console.error("Migration 022 failed:", err);
  process.exit(1);
});
