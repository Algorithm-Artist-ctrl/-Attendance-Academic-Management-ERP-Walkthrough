import fs from "fs";
import path from "path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "016_super_admin_credential_management.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 016...");
    await client.query(sql);
    console.log("✅ Migration 016 applied successfully.");

    // Verification of procedure existence
    const funcsRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname = 'admin_update_account_credentials';
    `);

    if (funcsRes.rows.length > 0) {
      console.log("Verified database function: admin_update_account_credentials (SECURITY DEFINER: " + funcsRes.rows[0].prosecdef + ")");
    } else {
      console.error("Function admin_update_account_credentials not found in pg_proc!");
      process.exitCode = 1;
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

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error("Migration 016 failed:", error?.message || error);
    process.exitCode = 1;
  });
