import fs from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required to run migrations.');
  process.exit(1);
}

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '017_class_coordinator_relational_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 017...');
    await client.query(sql);
    console.log('✅ Migration 017 applied successfully.');

    // Verification 1: Table existence
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'class_coordinator_assignments'
    `);
    console.log('Verified table class_coordinator_assignments:', tableRes.rows.length > 0 ? 'EXISTS' : 'NOT FOUND');

    // Verification 2: Check indexes
    const indexRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'class_coordinator_assignments'
    `);
    console.log('Verified indexes for class_coordinator_assignments:', indexRes.rows.map(r => r.indexname));

    // Verification 3: Check coordinator data
    const dataRes = await client.query(`
      SELECT cca.id, f.full_name as faculty_name, f.employee_code, s.name as section_name, ay.name as year_name, cca.active
      FROM class_coordinator_assignments cca
      JOIN faculty f ON f.id = cca.faculty_id
      JOIN sections s ON s.id = cca.section_id
      JOIN semesters sem ON sem.id = s.semester_id
      JOIN academic_years ay ON ay.id = sem.academic_year_id
      WHERE cca.active = true
      ORDER BY ay.year_number, s.name
    `);
    console.log('Active Coordinator Assignments in DB:');
    console.table(dataRes.rows);

  } finally {
    try {
      await client.end();
      console.log('Database connection closed cleanly.');
    } catch (closeErr) {
      console.error('Error closing connection:', closeErr);
    }
  }
}

main()
  .then(() => { process.exitCode = 0; })
  .catch((err) => {
    console.error('Migration 017 failed:', err);
    process.exitCode = 1;
  });
