import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

let connectionString = process.env.DATABASE_URL;
if (!connectionString && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if (match) {
    connectionString = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in process.env or .env file.');
}

async function applyMigration027() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Connected successfully to database.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '027_academic_management_and_promotion.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Migration 027 (Academic Management, Section Safeguards & Bulk Student Promotion)...');
    await client.query(sql);
    console.log('Migration 027 executed successfully!');

    // Verify created tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('promotion_batches', 'student_academic_history');
    `);
    console.log('Verified created tables:');
    console.table(tablesRes.rows);

    // Verify created RPC routines
    const rpcRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('check_section_references', 'promote_students_bulk');
    `);
    console.log('Verified created RPC functions:');
    console.table(rpcRes.rows);

    // Verify updated status constraint
    const checkRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'public.students'::regclass 
        AND conname = 'chk_students_status';
    `);
    console.log('Verified students table status constraint:');
    console.table(checkRes.rows);

    console.log('Migration 027 verified and completed successfully.');
  } catch (err: any) {
    console.error('Error applying Migration 027:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed cleanly.');
  }
}

applyMigration027();
