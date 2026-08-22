import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

async function runMigrations() {
  console.log('🚀 Connecting to Supabase PostgreSQL Database with direct SSL settings...');
  
  const client = new Client({
    host: 'db.obssoojzryqiudllnlkh.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'Tarun@7599',
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL instance!');

    const migration1Path = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
    const migration2Path = path.join(process.cwd(), 'supabase', 'migrations', '002_seed_vctm_cse_data.sql');

    console.log('\n📦 Applying Migration 001: Initial Schema & RLS Policies...');
    const sql1 = fs.readFileSync(migration1Path, 'utf8');
    await client.query(sql1);
    console.log('✅ Migration 001 applied successfully!');

    console.log('\n📦 Applying Migration 002: VCTM CSE Seed Data...');
    const sql2 = fs.readFileSync(migration2Path, 'utf8');
    await client.query(sql2);
    console.log('✅ Migration 002 applied successfully!');

    // Verify row counts
    const resStud = await client.query('SELECT count(*) FROM public.students;');
    console.log(`\n🎉 public.students count in Supabase = ${resStud.rows[0].count}`);

    const resFac = await client.query('SELECT count(*) FROM public.faculty;');
    console.log(`🎉 public.faculty count in Supabase = ${resFac.rows[0].count}`);

    const resTT = await client.query('SELECT count(*) FROM public.timetable_entries;');
    console.log(`🎉 public.timetable_entries count in Supabase = ${resTT.rows[0].count}`);

    console.log('\n=====================================================');
    console.log('  🔥 SUPABASE DATABASE SUCCESSFULLY MIGRATED & SEEDED! 🔥');
    console.log('=====================================================\n');
  } catch (err: any) {
    console.error('❌ Migration Error:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
