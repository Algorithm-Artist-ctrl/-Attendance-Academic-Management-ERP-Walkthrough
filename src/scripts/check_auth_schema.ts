import pg from 'pg';

const connectionString = process.env.DATABASE_URL || (process.env.SUPABASE_DB_PASSWORD
  ? 'postgresql://postgres.obssoojzryqiudllnlkh:' + encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  : '');

async function checkAuthCols() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected to PostgreSQL!');

  const usersCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log('--- auth.users columns ---');
  console.table(usersCols.rows);

  const idCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'identities'
    ORDER BY ordinal_position;
  `);
  console.log('--- auth.identities columns ---');
  console.table(idCols.rows);

  const authUserCount = await client.query('SELECT count(*) FROM auth.users;');
  console.log('Total auth.users count:', authUserCount.rows[0].count);

  const existingAuthUsers = await client.query('SELECT id, email, created_at FROM auth.users LIMIT 10;');
  console.log('Existing auth.users sample:');
  console.table(existingAuthUsers.rows);

  await client.end();
}

checkAuthCols().catch(console.error);
