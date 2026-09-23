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
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "050_reconcile_faculty_auth_identities.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Applying migration 050...");
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log("✅ Migration 050 applied successfully.");

    // Verification of procedure existence and Dr. Abhishek Garg state
    const funcsRes = await client.query(`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname = 'admin_update_account_credentials'
    `);
    console.log(`Verified database function: ${funcsRes.rows[0]?.proname} (SECURITY DEFINER: ${funcsRes.rows[0]?.prosecdef})`);

    const abhishekRes = await client.query(`
      SELECT 
        f.id as faculty_id,
        f.full_name,
        f.email as faculty_email,
        f.auth_user_id,
        p.email as profile_email,
        u.email as auth_email
      FROM public.faculty f
      LEFT JOIN public.profiles p ON p.id = f.auth_user_id
      LEFT JOIN auth.users u ON u.id = f.auth_user_id
      WHERE f.id = 'd515287a-d613-49d6-a163-691dc6cfa74a'
    `);
    console.log("Dr. Abhishek Garg synchronized status:");
    console.table(abhishekRes.rows);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
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
  console.error("Migration 050 failed:", err);
  process.exit(1);
});
