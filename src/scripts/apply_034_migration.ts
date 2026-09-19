import pg from "pg";
import path from "path";
import fs from "fs";

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

async function apply034() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL database...");

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '034_advanced_faculty_communication_center.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log("Applying Migration 034...");
  await client.query(sql);
  console.log("Migration 034 applied successfully!");

  console.log("Running ensure_academic_message_groups()...");
  const res = await client.query('SELECT public.ensure_academic_message_groups() as result;');
  console.log("ensure_academic_message_groups result:", res.rows[0].result);

  await client.end();
  console.log("Database connection closed.");
}

apply034().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
