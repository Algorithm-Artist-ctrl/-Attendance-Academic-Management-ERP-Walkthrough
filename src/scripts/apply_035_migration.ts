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

async function apply035() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL database...");

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '035_performance_and_fast_response_indexes.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log("Applying Migration 035 (Performance Composite Indexes)...");
  await client.query(sql);
  console.log("Migration 035 applied successfully!");

  await client.end();
  console.log("Database connection closed.");
}

apply035().catch(err => {
  console.error("Migration 035 failed:", err);
  process.exit(1);
});
