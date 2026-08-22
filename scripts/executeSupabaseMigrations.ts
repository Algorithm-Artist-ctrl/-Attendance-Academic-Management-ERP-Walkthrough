import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

const projectRef = 'obssoojzryqiudllnlkh';
const dbPassword = 'Tarun@759977';

// Endpoints to try
const configs = [
  {
    name: 'Session Pooler (Port 5432)',
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    user: `postgres.${projectRef}`,
    password: dbPassword,
    database: 'postgres',
  },
  {
    name: 'Transaction Pooler (Port 6543)',
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    user: `postgres.${projectRef}`,
    password: dbPassword,
    database: 'postgres',
  },
  {
    name: 'Direct Supabase DB Host',
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
  },
];

async function run() {
  console.log('🚀 Connecting to Supabase Cloud Database with updated password...\n');

  let client: pg.Client | null = null;
  let activeConfigName = '';

  for (const cfg of configs) {
    console.log(`Attempting connection via ${cfg.name} (${cfg.host}:${cfg.port})...`);
    const testClient = new Client({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 8000,
    });

    try {
      await testClient.connect();
      client = testClient;
      activeConfigName = cfg.name;
      console.log(`✅ Connected successfully via ${cfg.name}!\n`);
      break;
    } catch (err: any) {
      console.log(`❌ Connection attempt failed: ${err.message}\n`);
      await testClient.end().catch(() => {});
    }
  }

  if (!client) {
    console.error('❌ Could not connect with the provided credentials.');
    process.exit(1);
  }

  try {
    const migration1Path = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
    const migration2Path = path.join(process.cwd(), 'supabase', 'migrations', '002_seed_vctm_cse_data.sql');

    console.log('📦 [1/2] Executing 001_initial_schema.sql (Creating 17 relational tables, enums, triggers, RLS)...');
    const sql1 = fs.readFileSync(migration1Path, 'utf8');
    await client.query(sql1);
    console.log('✅ 001_initial_schema.sql executed successfully!\n');

    console.log('📦 [2/2] Executing 002_seed_vctm_cse_data.sql (Populating 106 students, 11 faculty, 10 subjects, timetable)...');
    const sql2 = fs.readFileSync(migration2Path, 'utf8');
    await client.query(sql2);
    console.log('✅ 002_seed_vctm_cse_data.sql executed successfully!\n');

    console.log('🔍 Verifying live rows in Supabase Cloud Database:');
    const resInst = await client.query('SELECT name, code FROM public.institutions;');
    console.log(`  🏢 Institution: ${resInst.rows[0]?.name} (Code: ${resInst.rows[0]?.code})`);

    const resDept = await client.query('SELECT count(*) FROM public.departments;');
    console.log(`  🏛️ Departments: ${resDept.rows[0]?.count}`);

    const resProg = await client.query('SELECT count(*) FROM public.programs;');
    console.log(`  🎓 Programs: ${resProg.rows[0]?.count}`);

    const resSec = await client.query('SELECT count(*) FROM public.sections;');
    console.log(`  🚪 Sections: ${resSec.rows[0]?.count}`);

    const resFac = await client.query('SELECT count(*) FROM public.faculty;');
    console.log(`  👨‍🏫 Faculty members: ${resFac.rows[0]?.count}`);

    const resSub = await client.query('SELECT count(*) FROM public.subjects;');
    console.log(`  📚 Subjects: ${resSub.rows[0]?.count}`);

    const resStud = await client.query('SELECT count(*) FROM public.students;');
    console.log(`  👨‍🎓 Students: ${resStud.rows[0]?.count}`);

    const resTT = await client.query('SELECT count(*) FROM public.timetable_entries;');
    console.log(`  📅 Timetable entries: ${resTT.rows[0]?.count}`);

    const resAtt = await client.query('SELECT count(*) FROM public.attendance_records;');
    console.log(`  📋 Attendance records: ${resAtt.rows[0]?.count}`);

    console.log('\n================================================================');
    console.log('  🎉 SUPABASE CLOUD DATABASE FULLY INITIALIZED & SEEDED! 🎉');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('❌ SQL Execution error:', err);
  } finally {
    await client.end();
  }
}

run();
